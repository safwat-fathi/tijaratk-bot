from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.domains.auth.dependencies import get_current_merchant
from app.domains.checkout.manual_order import ConversationNotFoundError, ProductNotFoundError, create_manual_order
from app.domains.checkout.schemas import ManualOrderCreate, ManualOrderRead, OrderRead, OrderStatusUpdate
from app.domains.messaging.models import TextMessage
from app.domains.messaging.sender import send_facebook_messages
from app.models import Channel, ChannelConnection, Conversation, Direction, Merchant, Message, Order
from app.models._ids import new_id
from app.models.enums import OrderStatus

router = APIRouter()


@router.get("/", response_model=list[OrderRead], status_code=200)
async def list_orders(
    current_merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> list[OrderRead]:
    stmt = (
        select(Order)
        .join(Message, Order.message_id == Message.id)
        .where(Order.merchant_id == current_merchant.id)
        .options(selectinload(Order.items), selectinload(Order.message))
        .order_by(Message.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/manual", response_model=ManualOrderRead, status_code=201)
async def create_manual(
    payload: ManualOrderCreate,
    current_merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> ManualOrderRead:
    try:
        result = await create_manual_order(db, current_merchant.id, payload)
    except ConversationNotFoundError:
        raise HTTPException(status_code=404, detail="conversation not found")
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"product not found: {exc.product_id}")
    await db.commit()
    return result


@router.patch("/{order_id}/status", response_model=OrderRead)
async def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    current_merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> OrderRead:
    stmt = (
        select(Order)
        .where(Order.id == order_id, Order.merchant_id == current_merchant.id)
        .options(selectinload(Order.items), selectinload(Order.message))
    )
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="order not found")

    try:
        new_status = OrderStatus(payload.status)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid status")

    order.status = new_status

    # Map status to a localized notification message
    status_messages = {
        OrderStatus.PREPARING: f"طلبك رقم #{order.order_number or ''} الآن قيد التحضير! ⏳",
        OrderStatus.OUT_FOR_DELIVERY: f"طلبك رقم #{order.order_number or ''} في الطريق إليك! 🛵",
        OrderStatus.COMPLETED: f"تم استلام طلبك رقم #{order.order_number or ''}. شكراً لاختيارك لنا! ✅",
        OrderStatus.CANCELLED: f"تم إلغاء طلبك رقم #{order.order_number or ''}. ❌",
    }

    notification_text = status_messages.get(new_status)

    if notification_text:
        # Get conversation to find channel connection
        conv = await db.get(Conversation, order.conversation_id)
        if conv and conv.channel_connection_id:
            connection = await db.get(ChannelConnection, conv.channel_connection_id)
            if connection and connection.page_access_token and connection.channel == Channel.FACEBOOK:
                # Save outgoing message in DB for history
                msg_model = TextMessage(text=notification_text)
                outbound = Message(
                    id=new_id(),
                    conversation_id=conv.id,
                    direction=Direction.OUTBOUND,
                    raw_text=msg_model.text_fallback(),
                    normalized_text=msg_model.text_fallback(),
                    message_type=msg_model.kind,
                    rich_payload=msg_model.model_dump(mode="json"),
                )
                db.add(outbound)

                # Send to Facebook
                await send_facebook_messages(
                    connection.page_access_token,
                    conv.customer_ref,
                    [msg_model],
                )

    await db.commit()
    await db.refresh(order)
    return order
