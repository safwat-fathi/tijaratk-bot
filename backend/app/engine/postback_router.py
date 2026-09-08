"""L0 deterministic postback router.

Maps structured postback/quick-reply payloads (button taps) to outbound
messages. No AI involved — all responses are built from database queries
and the semantic message model.
"""

from __future__ import annotations

import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domains.cart.service import add_item
from app.domains.messaging.models import (
    Button,
    ButtonMessage,
    GenericElement,
    GenericTemplateMessage,
    OutboundMessage,
    QuickReply,
    QuickReplyMessage,
    TextMessage,
)
from app.models.cart import Cart
from app.models.enums import CartStatus, VariantStatus
from app.models.product import Product
from app.models.product_variant import ProductVariant

logger = logging.getLogger(__name__)

# Maximum products per carousel page (Facebook limits to 10 elements)
_PAGE_SIZE = 10


def main_menu_message(
    merchant_name: str,
    welcome_message_template: str = "أهلاً بيك في {store_name}! 👋\nتحب تعمل إيه؟",
) -> QuickReplyMessage:
    """Build the main menu quick-reply message."""
    text = welcome_message_template.replace("{store_name}", merchant_name)
    return QuickReplyMessage(
        text=text,
        quick_replies=[
            QuickReply(title="🛍️ تصفح المنتجات", payload={"action": "browse_categories"}),
            QuickReply(title="🔍 ابحث عن منتج", payload={"action": "search_prompt"}),
            QuickReply(title="🛒 السلة", payload={"action": "view_cart"}),
        ],
    )


async def handle_postback(
    session: AsyncSession,
    merchant_id: str,
    conversation_id: str,
    payload: dict,
) -> list[OutboundMessage]:
    """Route a postback payload to the appropriate handler and return messages."""
    action = payload.get("action", "")

    try:
        if action == "main_menu":
            return await _handle_main_menu(session, merchant_id, conversation_id)
        if action == "browse_categories":
            return await _handle_browse_categories(session, merchant_id, conversation_id)
        if action == "start_checkout":
            return await _handle_start_checkout(session, merchant_id, conversation_id)
        if action == "view_category":
            return await _handle_view_category(session, merchant_id, payload)
        if action == "view_product":
            return await _handle_view_product(session, merchant_id, payload)
        if action == "add_to_cart":
            return await _handle_add_to_cart(session, merchant_id, conversation_id, payload)
        if action == "view_cart":
            return await _handle_view_cart(session, merchant_id, conversation_id)
        if action == "search_prompt":
            return [TextMessage(text="اكتب اسم المنتج أو وصفه وأنا هبحثلك 🔍")]
    except Exception as exc:  # noqa: BLE001 — deterministic router must never crash the pipeline
        logger.warning("postback_handler_error action=%s error=%s", action, exc)
        return [
            TextMessage(text="معلش حصلت مشكلة بسيطة. ممكن تجرب تاني؟"),
            QuickReplyMessage(
                text="تحب ترجع للقائمة الرئيسية؟",
                quick_replies=[QuickReply(title="🏠 القائمة", payload={"action": "main_menu"})],
            ),
        ]

    logger.info("unknown_postback_action action=%s payload=%s", action, json.dumps(payload, ensure_ascii=False))
    return [
        QuickReplyMessage(
            text="مش متأكد إيه اللي تقصده. جرب من القائمة الرئيسية.",
            quick_replies=[QuickReply(title="🏠 القائمة", payload={"action": "main_menu"})],
        )
    ]


# ---------------------------------------------------------------------------
# Individual handlers
# ---------------------------------------------------------------------------


async def _clear_deterministic_checkout_state(session: AsyncSession, conversation_id: str) -> None:
    from app.models.conversation import Conversation
    conversation = await session.get(Conversation, conversation_id)
    if conversation and "deterministic_checkout_step" in conversation.slots:
        slots = dict(conversation.slots)
        slots.pop("deterministic_checkout_step", None)
        conversation.slots = slots


async def _handle_main_menu(session: AsyncSession, merchant_id: str, conversation_id: str) -> list[OutboundMessage]:
    from app.models.channel_connection import ChannelConnection
    from app.models.conversation import Conversation
    from app.models.merchant import Merchant

    await _clear_deterministic_checkout_state(session, conversation_id)

    result = await session.execute(
        select(ChannelConnection.account_name, Merchant.name)
        .select_from(Conversation)
        .outerjoin(ChannelConnection, Conversation.channel_connection_id == ChannelConnection.id)
        .join(Merchant, Merchant.id == Conversation.merchant_id)
        .where(Conversation.id == conversation_id)
    )
    row = result.first()
    if row:
        account_name, merchant_name = row
        display_name = account_name or merchant_name or "المتجر"
    else:
        display_name = "المتجر"

    return [main_menu_message(display_name)]


async def _handle_browse_categories(
    session: AsyncSession, merchant_id: str, conversation_id: str
) -> list[OutboundMessage]:
    await _clear_deterministic_checkout_state(session, conversation_id)
    result = await session.execute(
        select(Product.category)
        .where(Product.merchant_id == merchant_id, Product.category.is_not(None))
        .distinct()
        .order_by(Product.category)
    )
    categories = [row[0] for row in result.all()]

    if not categories:
        return [TextMessage(text="لسه مفيش أقسام متاحة حالياً.")]

    quick_replies = [
        QuickReply(
            title=cat[:20],
            payload={"action": "view_category", "category": cat},
        )
        for cat in categories[:13]  # Facebook caps at 13 quick replies
    ]
    return [QuickReplyMessage(text="اختار القسم:", quick_replies=quick_replies)]


async def _handle_view_category(
    session: AsyncSession, merchant_id: str, payload: dict
) -> list[OutboundMessage]:
    category = payload.get("category", "")
    offset = payload.get("offset", 0)

    result = await session.execute(
        select(Product)
        .where(Product.merchant_id == merchant_id, Product.category == category)
        .order_by(Product.name)
        .offset(offset)
        .limit(_PAGE_SIZE + 1)  # fetch one extra to detect "has more"
    )
    products = result.scalars().all()

    has_more = len(products) > _PAGE_SIZE
    display_products = products[:_PAGE_SIZE]

    if not display_products:
        return [TextMessage(text=f"مفيش منتجات في قسم «{category}» حالياً.")]

    elements = []
    for p in display_products:
        price_text = f"{float(p.price)} جنيه" if p.price else ""
        subtitle = p.description[:80] if p.description else price_text
        if p.price and p.description:
            subtitle = f"{price_text} — {p.description[:60]}"

        buttons = [
            Button(
                title="أضف للسلة",
                payload={
                    "action": "view_product",
                    "product_id": p.id,
                    "_echo": f"أضف {p.name} إلى السلة"
                },
            )
        ]
        elements.append(
            GenericElement(
                title=p.name[:80],
                subtitle=subtitle[:80] if subtitle else None,
                image_url=p.image_url,
                buttons=buttons,
            )
        )

    messages: list[OutboundMessage] = [GenericTemplateMessage(elements=elements)]

    # Pagination: add a "Next" quick reply if there are more products
    nav_replies = [QuickReply(title="🏠 القائمة", payload={"action": "main_menu"})]
    if has_more:
        nav_replies.insert(
            0,
            QuickReply(
                title="التالي ⬅️",
                payload={"action": "view_category", "category": category, "offset": offset + _PAGE_SIZE},
            ),
        )
    messages.append(QuickReplyMessage(text=f"{category} — {len(display_products)} منتج", quick_replies=nav_replies))

    return messages


async def _handle_view_product(
    session: AsyncSession, merchant_id: str, payload: dict
) -> list[OutboundMessage]:
    product_id = payload.get("product_id", "")
    product = await session.get(Product, product_id, options=[selectinload(Product.variants)])
    if product is None or product.merchant_id != merchant_id:
        return [TextMessage(text="المنتج مش موجود أو تم حذفه.")]

    price_text = f"💰 {float(product.price)} جنيه" if product.price else ""
    desc = f"\n{product.description}" if product.description else ""
    detail_text = f"*{product.name}*\n{price_text}{desc}"

    messages: list[OutboundMessage] = []

    # Show product image if available
    if product.image_url:
        from app.domains.messaging.models import MediaMessage

        messages.append(MediaMessage(media_type="image", url=product.image_url))

    active_variants = [v for v in product.variants if v.status == VariantStatus.ACTIVE]

    if active_variants:
        # Show variants as quick reply chips for selection
        variant_replies = [
            QuickReply(
                title=v.label[:20],
                payload={
                    "action": "add_to_cart",
                    "product_id": product.id,
                    "variant_id": v.id,
                },
            )
            for v in active_variants[:13]
        ]
        messages.append(
            QuickReplyMessage(
                text=f"{detail_text}\n\nاختار النوع:",
                quick_replies=variant_replies,
            )
        )
    else:
        # No variants — direct add-to-cart button
        messages.append(
            ButtonMessage(
                text=detail_text,
                buttons=[
                    Button(
                        title="أضف للسلة 🛒",
                        payload={
                            "action": "add_to_cart",
                            "product_id": product.id,
                            "_echo": f"أضف {product.name} إلى السلة"
                        },
                    ),
                    Button(title="🏠 القائمة", payload={"action": "main_menu"}),
                ],
            )
        )

    return messages


async def _handle_start_checkout(
    session: AsyncSession, merchant_id: str, conversation_id: str
) -> list[OutboundMessage]:
    from app.models.conversation import Conversation

    conversation = await session.get(Conversation, conversation_id)
    slots = dict(conversation.slots)
    slots["deterministic_checkout_step"] = "name"
    conversation.slots = slots

    return [TextMessage(text="ممتاز! عشان نقدر نوصلك الطلب، محتاجين شوية بيانات.\n\nالاسم بالكامل؟")]


async def _handle_add_to_cart(
    session: AsyncSession, merchant_id: str, conversation_id: str, payload: dict
) -> list[OutboundMessage]:
    product_id = payload.get("product_id", "")
    variant_id = payload.get("variant_id")
    quantity = payload.get("quantity", 1)

    result = await add_item(
        session,
        merchant_id=merchant_id,
        conversation_id=conversation_id,
        product_id=product_id,
        variant_id=variant_id,
        quantity=quantity,
    )

    product = await session.get(Product, product_id)
    product_name = product.name if product else "المنتج"

    variant_label = ""
    if variant_id:
        variant = await session.get(ProductVariant, variant_id)
        if variant:
            variant_label = f" ({variant.label})"

    return [
        QuickReplyMessage(
            text=f"✅ تم إضافة {product_name}{variant_label} للسلة (الكمية: {result['quantity']})",
            quick_replies=[
                QuickReply(title="🛒 السلة", payload={"action": "view_cart"}),
                QuickReply(title="🛍️ متابعة التسوق", payload={"action": "browse_categories"}),
                QuickReply(title="🏠 القائمة", payload={"action": "main_menu"}),
            ],
        )
    ]


async def _handle_view_cart(
    session: AsyncSession, merchant_id: str, conversation_id: str
) -> list[OutboundMessage]:
    result = await session.execute(
        select(Cart)
        .where(
            Cart.conversation_id == conversation_id,
            Cart.merchant_id == merchant_id,
            Cart.status == CartStatus.ACTIVE,
        )
        .options(selectinload(Cart.items))
    )
    cart = result.scalar_one_or_none()

    if cart is None or not cart.items:
        return [
            QuickReplyMessage(
                text="🛒 السلة فاضية.\nتحب تتصفح المنتجات؟",
                quick_replies=[
                    QuickReply(title="🛍️ تصفح المنتجات", payload={"action": "browse_categories"}),
                    QuickReply(title="🏠 القائمة", payload={"action": "main_menu"}),
                ],
            )
        ]

    lines: list[str] = []
    total = 0.0
    for item in cart.items:
        product = await session.get(Product, item.product_id)
        product_name = product.name if product else "منتج"
        variant_label = ""
        if item.variant_id:
            variant = await session.get(ProductVariant, item.variant_id)
            if variant:
                variant_label = f" - {variant.label}"
                base_price = float(product.price) if product and product.price else 0
                item_price = float(variant.price) if variant.price else base_price
            else:
                item_price = float(product.price) if product and product.price else 0
        else:
            item_price = float(product.price) if product and product.price else 0

        line_total = item_price * item.quantity
        total += line_total
        qty_display = int(item.quantity) if item.quantity == int(item.quantity) else item.quantity
        lines.append(f"• {qty_display}x {product_name}{variant_label}\n  {line_total:.0f} جنيه")

    cart_text = "🛒 السلة\n\n" + "\n\n".join(lines) + f"\n\n💰 الإجمالي: {total:.0f} جنيه"

    return [
        ButtonMessage(
            text=cart_text,
            buttons=[
                Button(title="✅ إتمام الطلب", payload={"action": "start_checkout"}),
                Button(title="🛍️ متابعة التسوق", payload={"action": "browse_categories"}),
            ],
        )
    ]
