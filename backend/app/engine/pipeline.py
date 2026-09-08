import logging
from dataclasses import dataclass, field

from sqlalchemy import String, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.domains.checkout.order_writer import write_order
from app.domains.handoff.service import takeover_conversation
from app.domains.messaging.models import OutboundMessage, QuickReply, QuickReplyMessage, TextMessage
from app.domains.store_knowledge import service as knowledge_service
from app.engine.classification import classify_message
from app.engine.clients import AICallError
from app.engine.context_budget import build_context_prompt
from app.engine.cost import estimate_cost
from app.engine.embeddings import embed_text, find_similar_examples
from app.engine.extraction import extract_order
from app.engine.gateway import CallUsage
from app.engine.generation import generate_reply
from app.engine.postback_router import handle_postback, main_menu_message
from app.engine.product_matching import (
    build_resolved_order_lines,
    match_line_items_to_products,
    resolve_variants_for_line_items,
)
from app.engine.tier0_rules import match_tier0
from app.models import (
    AIUsageEvent,
    Conversation,
    ConvState,
    LabeledExample,
    Merchant,
    Message,
    ModelTier,
    Order,
    OrderSource,
    OrderStatus,
)
from app.models.enums import DEFAULT_INTENTS, HandoffReason

logger = logging.getLogger(__name__)


@dataclass
class PipelineResult:
    message: Message
    order: Order | None
    messages: list[OutboundMessage] = field(default_factory=list)


def _usage_event(
    conversation_id: str, message_id: str, usage: CallUsage | None, *, success: bool, failed_tier: str | None = None
) -> AIUsageEvent:
    if usage is not None:
        return AIUsageEvent(
            conversation_id=conversation_id,
            message_id=message_id,
            tier=usage.tier,
            provider=usage.provider,
            model=usage.model,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            latency_ms=usage.latency_ms,
            estimated_cost=estimate_cost(usage.model, usage.input_tokens, usage.output_tokens),
            success=success,
        )
    return AIUsageEvent(
        conversation_id=conversation_id,
        message_id=message_id,
        tier=failed_tier or "unknown",
        provider="openrouter",
        model="unknown",
        input_tokens=None,
        output_tokens=None,
        latency_ms=0.0,
        estimated_cost=None,
        success=False,
    )


async def _trigger_escalation(session: AsyncSession, conversation: Conversation, message: Message, reason: str) -> None:
    if not message.escalation_reason:
        message.escalation_reason = reason
    await takeover_conversation(
        session, conversation.merchant_id, conversation.id, HandoffReason.AI_ESCALATION, notes=reason
    )


async def _known_intents(session: AsyncSession, merchant_id: str) -> list[str]:
    messages = await session.execute(
        select(Message.intent)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(Message.intent.is_not(None), Conversation.merchant_id == merchant_id)
        .distinct()
    )
    labeled = await session.execute(
        select(LabeledExample.intent)
        .where(LabeledExample.intent.is_not(None), LabeledExample.merchant_id == merchant_id)
        .distinct()
    )
    observed = {row[0] for row in messages.all()} | {row[0] for row in labeled.all()}
    return sorted(observed | set(DEFAULT_INTENTS))


async def _correction_count(session: AsyncSession, conversation_id: str) -> int:
    result = await session.execute(
        select(func.count(Order.id)).where(
            Order.conversation_id == conversation_id,
            or_(
                Order.status == OrderStatus.REJECTED,
                and_(
                    Order.confirmed_payload.is_not(None),
                    Order.confirmed_payload.cast(String) != Order.extracted_payload.cast(String),
                ),
            ),
        )
    )
    return result.scalar_one()


async def _merchant_info(session: AsyncSession, merchant_id: str) -> tuple[str, bool, bool, str | None]:
    result = await session.execute(
        select(
            Merchant.name,
            Merchant.ai_tool_ordering_enabled,
            Merchant.ai_enabled,
            Merchant.welcome_message,
        ).where(Merchant.id == merchant_id)
    )
    return result.one()


async def _generate_reply(
    session: AsyncSession,
    conversation: Conversation,
    message: Message,
    *,
    merchant_name: str,
    user_prompt: str,
) -> str | None:
    """Best-effort AI reply generation. On AI call failure, returns None so the
    worker falls back to its last-resort static strings (never silence)."""
    try:
        reply, usage = await generate_reply(
            user_prompt=user_prompt,
            merchant_name=merchant_name,
            conv_state=conversation.state,
            slots=conversation.slots,
        )
    except AICallError as exc:
        logger.warning("generation_failed message_id=%s error=%s", message.id, exc)
        session.add(_usage_event(conversation.id, message.id, None, success=False, failed_tier="deepseek"))
        return None
    session.add(_usage_event(conversation.id, message.id, usage, success=True))
    return reply


def _text_to_messages(text: str | None) -> list[OutboundMessage]:
    """Wrap an AI-generated text reply into a list of OutboundMessage."""
    if text:
        return [TextMessage(text=text)]
    return []


async def process_message(session: AsyncSession, conversation: Conversation, message: Message) -> PipelineResult:
    session.add(message)
    normalized_text = message.normalized_text

    merchant_name, ai_tool_ordering_enabled, merchant_ai_enabled, welcome_msg = await _merchant_info(
        session, conversation.merchant_id
    )
    welcome_msg_template = welcome_msg or "أهلاً بيك في {store_name}! 👋\nتحب تعمل إيه؟"

    from app.models.channel_connection import ChannelConnection
    cc_name = await session.scalar(
        select(ChannelConnection.account_name).where(ChannelConnection.id == conversation.channel_connection_id)
    )
    display_name = cc_name or merchant_name or "المتجر"

    # --- Postback routing (L0 deterministic, no AI needed) ---
    if message.postback_payload and isinstance(message.postback_payload, dict):
        message.intent = f"postback:{message.postback_payload.get('action', 'unknown')}"
        message.intent_confidence = 1.0
        message.model_tier = ModelTier.RULE
        outbound = await handle_postback(
            session,
            merchant_id=conversation.merchant_id,
            conversation_id=conversation.id,
            payload=message.postback_payload,
        )
        await session.flush()
        return PipelineResult(message=message, order=None, messages=outbound)

    tier0_intent = match_tier0(normalized_text)
    if tier0_intent:
        message.intent = tier0_intent
        message.intent_confidence = 1.0
        message.model_tier = ModelTier.RULE
        outbound: list[OutboundMessage] = []
        if tier0_intent == "greeting":
            if merchant_ai_enabled and conversation.ai_enabled and not conversation.human_takeover:
                ai_text = await _generate_reply(
                    session,
                    conversation,
                    message,
                    merchant_name=merchant_name,
                    user_prompt=(
                        f"customer: {normalized_text}\n"
                        "The customer just greeted you. Greet them back and ask how you can help."
                    ),
                )
                if ai_text:
                    outbound.append(TextMessage(text=ai_text))
            # Always append the main menu after greeting
            outbound.append(main_menu_message(display_name, welcome_msg_template))
        await session.flush()
        return PipelineResult(message=message, order=None, messages=outbound)

    if not merchant_ai_enabled or not conversation.ai_enabled or conversation.human_takeover:
        outbound: list[OutboundMessage] = []
        if not conversation.human_takeover:
            checkout_step = conversation.slots.get("deterministic_checkout_step")
            if checkout_step:
                outbound = await _handle_deterministic_checkout_step(session, conversation, message)
            else:
                message.intent = "fallback:no_ai"
                message.intent_confidence = 1.0
                message.model_tier = ModelTier.RULE
                outbound = [
                    TextMessage(text="أهلاً بك! تقدر تستخدم القائمة تحت عشان تختار اللي انت محتاجه."),
                    main_menu_message(display_name, welcome_msg_template),
                ]
        await session.flush()
        return PipelineResult(message=message, order=None, messages=outbound)

    # Read history BEFORE any flush of `message`
    history_result = await session.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id, Message.id != message.id)
        .order_by(Message.created_at.desc())
        .limit(settings.CONTEXT_HISTORY_TURNS)
    )
    history = list(reversed(history_result.scalars().all()))

    examples: list[LabeledExample] = []
    try:
        message.embedding = await embed_text(normalized_text)
        examples = await find_similar_examples(session, message.embedding, conversation.merchant_id)
    except AICallError as exc:
        logger.warning("embedding_failed message_id=%s error=%s", message.id, exc)

    prompt = build_context_prompt(
        history=history,
        slots=conversation.slots,
        current_text=normalized_text,
        max_turns=settings.CONTEXT_HISTORY_TURNS,
        examples=examples,
    )

    known_intents = await _known_intents(session, conversation.merchant_id)
    correction_count = await _correction_count(session, conversation.id)

    if ai_tool_ordering_enabled:
        from app.engine.action_resolution import resolve_action

        resolution = await resolve_action(session, conversation, message)
        message.model_tier = ModelTier.DEEPSEEK

        outbound: list[OutboundMessage] = []
        if resolution.escalation_reason:
            await _trigger_escalation(session, conversation, message, resolution.escalation_reason)
        else:
            ai_text = await _generate_reply(
                session,
                conversation,
                message,
                merchant_name=merchant_name,
                user_prompt=(
                    f"customer: {normalized_text}\n"
                    f"action_result: {resolution.response_text}\n"
                    "Turn the action_result facts into a natural reply to the customer."
                ),
            )
            outbound = _text_to_messages(ai_text)

        await session.flush()
        return PipelineResult(message=message, order=None, messages=outbound)

    try:
        classification, reason, usage = await classify_message(
            prompt,
            known_intents,
            settings.CLASSIFICATION_CONFIDENCE_THRESHOLD,
            correction_count,
            normalized_text,
            merchant_name,
            conversation.state,
            conversation.slots,
        )
    except AICallError as exc:
        logger.warning("classification_failed message_id=%s error=%s", message.id, exc)
        session.add(_usage_event(conversation.id, message.id, None, success=False, failed_tier="deepseek"))
        if not message.escalation_reason:
            message.escalation_reason = "ai_call_failed"
        outbound = [
            QuickReplyMessage(
                text="عذراً، حصلت مشكلة في النظام. تحب نحولك لخدمة العملاء؟",
                quick_replies=[
                    QuickReply(title="نعم، تواصل مع الدعم", payload={"action": "escalate", "reason": "ai_call_failed"}),
                    QuickReply(title="لا، القائمة الرئيسية", payload={"action": "main_menu"}),
                ]
            )
        ]
        await session.flush()
        return PipelineResult(message=message, order=None, messages=outbound)

    if usage is not None:
        session.add(_usage_event(conversation.id, message.id, usage, success=True))
    message.intent = classification.intent
    message.intent_confidence = classification.confidence
    message.model_tier = ModelTier.DEEPSEEK

    if reason:
        if not message.escalation_reason:
            message.escalation_reason = reason
        outbound = [
            QuickReplyMessage(
                text="عذراً، مش قادرين نفهم طلبك بالظبط. تحب نحولك لخدمة العملاء؟",
                quick_replies=[
                    QuickReply(title="نعم، تواصل مع الدعم", payload={"action": "escalate", "reason": reason}),
                    QuickReply(title="لا، القائمة الرئيسية", payload={"action": "main_menu"}),
                ]
            )
        ]
        await session.flush()
        return PipelineResult(message=message, order=None, messages=outbound)

    order = None
    if classification.intent == "purchase_intent" and conversation.state in (ConvState.GATHERING, ConvState.CONFIRMING):
        extraction_prompt = build_context_prompt(
            history=history,
            slots=conversation.slots,
            current_text=normalized_text,
            max_turns=settings.CONTEXT_HISTORY_TURNS,
            examples=examples,
            mode="extraction",
        )
        try:
            extraction, extraction_reason, extraction_usage = await extract_order(
                extraction_prompt,
                settings.CLASSIFICATION_CONFIDENCE_THRESHOLD,
                correction_count,
                normalized_text,
                merchant_name,
                conversation.state,
                conversation.slots,
            )
        except AICallError as exc:
            logger.warning("extraction_failed message_id=%s error=%s", message.id, exc)
            session.add(_usage_event(conversation.id, message.id, None, success=False, failed_tier="deepseek"))
            if not message.escalation_reason:
                message.escalation_reason = "ai_call_failed"
            outbound = [
                QuickReplyMessage(
                    text="عذراً، حصلت مشكلة في النظام. تحب نحولك لخدمة العملاء؟",
                    quick_replies=[
                        QuickReply(title="نعم، تواصل مع الدعم", payload={"action": "escalate", "reason": "ai_call_failed"}),  # noqa: E501
                        QuickReply(title="لا، القائمة الرئيسية", payload={"action": "main_menu"}),
                    ]
                )
            ]
            await session.flush()
            return PipelineResult(message=message, order=None, messages=outbound)

        if extraction_usage is not None:
            session.add(_usage_event(conversation.id, message.id, extraction_usage, success=True))

        if not extraction.line_items and extraction_reason == "confidence_below_threshold":
            # Likely a misclassified policy question. Drop order extraction and let it fall through to knowledge base.
            order = None
        else:
            if extraction_reason:
                if not message.escalation_reason:
                    message.escalation_reason = extraction_reason
                outbound = [
                    QuickReplyMessage(
                        text="عذراً، مش قادرين نفهم تفاصيل الطلب بالظبط. تحب نحولك لخدمة العملاء؟",
                        quick_replies=[
                            QuickReply(title="نعم، تواصل مع الدعم", payload={"action": "escalate", "reason": extraction_reason}),  # noqa: E501
                            QuickReply(title="لا، القائمة الرئيسية", payload={"action": "main_menu"}),
                        ]
                    )
                ]
                await session.flush()
                return PipelineResult(message=message, order=None, messages=outbound)

            extraction.line_items = await match_line_items_to_products(
                session, conversation.merchant_id, extraction.line_items
            )
            extraction.line_items = await resolve_variants_for_line_items(session, extraction.line_items)
            resolved_lines, all_resolved = await build_resolved_order_lines(session, extraction.line_items)
            status = (
                OrderStatus.AUTO_CONFIRMED
                if all_resolved
                and not extraction.ambiguous_fields
                and extraction.confidence >= settings.CLASSIFICATION_CONFIDENCE_THRESHOLD
                else OrderStatus.PENDING_REVIEW
            )
            order = await write_order(
                session,
                merchant_id=conversation.merchant_id,
                conversation_id=conversation.id,
                message_id=message.id,
                status=status,
                source=OrderSource.AI_EXTRACTION,
                lines=resolved_lines,
                extracted_payload=extraction.model_dump(mode="json"),
                confidence_score=extraction.confidence,
                extracted_by_tier=ModelTier.DEEPSEEK,
                escalation_reason=None,
                assign_order_number=False,
            )

    outbound: list[OutboundMessage] = []
    if order is not None:
        # Order confirmation as text (ReceiptMessage will be used once checkout flow is complete)
        order_display = order.order_number or order.id[:8]
        outbound = [TextMessage(text=f"تم استلام طلبك #{order_display}. هنتواصل معاك قريب!")]
    else:
        knowledge_matches = await knowledge_service.search(session, conversation.merchant_id, normalized_text)
        if knowledge_matches:
            gen_prompt = (
                f"customer: {normalized_text}\n"
                f"store_info: {knowledge_matches[0]['content']}\n"
                "Answer the customer's question using store_info."
            )
        else:
            gen_prompt = (
                f"customer: {normalized_text}\n"
                "No store_info is available. Respond naturally to the customer; "
                "if you cannot answer their question, say you will check and get back to them."
            )
        ai_text = await _generate_reply(
            session, conversation, message, merchant_name=merchant_name, user_prompt=gen_prompt
        )
        outbound = _text_to_messages(ai_text)

    await session.flush()
    return PipelineResult(message=message, order=order, messages=outbound)


async def _handle_deterministic_checkout_step(
    session: AsyncSession, conversation: Conversation, message: Message
) -> list[OutboundMessage]:
    import re

    from app.domains.checkout import service as checkout_service

    step = conversation.slots.get("deterministic_checkout_step")
    slots = dict(conversation.slots)
    outbound: list[OutboundMessage] = []
    text = message.normalized_text

    message.intent = f"checkout_step:{step}"
    message.intent_confidence = 1.0
    message.model_tier = ModelTier.RULE

    if step == "name":
        slots["customer_name"] = text
        slots["deterministic_checkout_step"] = "phone"
        outbound.append(TextMessage(text=f"أهلاً بك يا {text}!\n\nبرجاء إدخال رقم الموبايل للتواصل:"))

    elif step == "phone":
        if not re.match(r"^01[0125]\d{8}$", text.replace(" ", "")):
            outbound.append(TextMessage(text="رقم الموبايل غير صحيح. يرجى إدخال رقم مصري صحيح (مثال: 01012345678):"))
        else:
            slots["customer_phone"] = text.replace(" ", "")
            slots["deterministic_checkout_step"] = "address"
            outbound.append(TextMessage(text="شكراً لك.\n\nأخيراً، برجاء كتابة عنوان التوصيل بالتفصيل:"))

    elif step == "address":
        slots["customer_address"] = text
        slots.pop("deterministic_checkout_step", None)
        conversation.slots = slots  # Must set here before checkout_service reads it

        try:
            order_data = await checkout_service.create_order(
                session, conversation.merchant_id, conversation.id, confirm=True, message_id=message.id
            )
            outbound.append(
                TextMessage(text=f"تم تأكيد طلبك بنجاح! رقم الطلب: {order_data['order_number']} وسيتم التوصيل قريباً.")
            )
            outbound.append(QuickReplyMessage(
                text="تحب تعمل حاجة تانية؟",
                quick_replies=[QuickReply(title="🏠 القائمة", payload={"action": "main_menu"})]
            ))
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("deterministic_checkout_failed error=%s", e)
            outbound.append(
                TextMessage(text="عفواً، حدثت مشكلة أثناء إتمام الطلب. يرجى مراجعة السلة أو المحاولة لاحقاً.")
            )
            outbound.append(QuickReplyMessage(
                text="الرجوع للقائمة الرئيسية:",
                quick_replies=[QuickReply(title="🏠 القائمة", payload={"action": "main_menu"})]
            ))

    conversation.slots = slots
    return outbound
