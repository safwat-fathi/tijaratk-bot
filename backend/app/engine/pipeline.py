import logging
from dataclasses import dataclass

from sqlalchemy import String, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.domains.checkout.order_writer import write_order
from app.domains.handoff.service import takeover_conversation
from app.domains.store_knowledge import service as knowledge_service
from app.engine.classification import classify_message
from app.engine.clients import AICallError
from app.engine.context_budget import build_context_prompt
from app.engine.cost import estimate_cost
from app.engine.embeddings import embed_text, find_similar_examples
from app.engine.extraction import extract_order
from app.engine.gateway import CallUsage
from app.engine.generation import generate_reply
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
    answer_text: str | None = None


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


async def _merchant_info(session: AsyncSession, merchant_id: str) -> tuple[str, bool, bool]:
    result = await session.execute(
        select(Merchant.name, Merchant.ai_tool_ordering_enabled, Merchant.ai_enabled).where(Merchant.id == merchant_id)
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


async def process_message(session: AsyncSession, conversation: Conversation, message: Message) -> PipelineResult:
    # `message` may be a brand-new, not-yet-flushed object (the internal
    # POST /messages caller) or an already-persistent row loaded by the arq
    # worker (the channel-ingestion caller, which inserted it in a prior
    # transaction for dedup purposes) — session.add() is a safe no-op for
    # the latter. Either way `message.id` must already be set (both callers
    # pass id=new_id() explicitly) so the history exclusion below works
    # regardless of flush timing.
    session.add(message)
    normalized_text = message.normalized_text
    tier0_intent = match_tier0(normalized_text)

    merchant_name, ai_tool_ordering_enabled, merchant_ai_enabled = await _merchant_info(
        session, conversation.merchant_id
    )

    if not merchant_ai_enabled or not conversation.ai_enabled or conversation.human_takeover:
        await session.flush()
        return PipelineResult(message=message, order=None)

    # Read history BEFORE any flush of `message` — session.execute() autoflushes,
    # which would otherwise put the message being classified into its own history
    # and duplicate it against build_context_prompt's current_line. Excluding
    # message.id explicitly (rather than relying on flush timing) makes this
    # correct whether `message` is pending or already persistent.
    history_result = await session.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id, Message.id != message.id)
        .order_by(Message.created_at.desc())
        .limit(settings.CONTEXT_HISTORY_TURNS)
    )
    history = list(reversed(history_result.scalars().all()))

    if tier0_intent:
        message.intent = tier0_intent
        message.intent_confidence = 1.0
        message.model_tier = ModelTier.RULE
        answer_text = None
        if tier0_intent == "greeting":
            # ponytail: 1 extra LLM call per greeting — skip generation and let
            # the worker fallback reply if cost ever matters more than voice.
            answer_text = await _generate_reply(
                session,
                conversation,
                message,
                merchant_name=merchant_name,
                user_prompt=(
                    f"customer: {normalized_text}\n"
                    "The customer just greeted you. Greet them back and ask how you can help."
                ),
            )
        await session.flush()
        return PipelineResult(message=message, order=None, answer_text=answer_text)

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

        answer_text = None
        if resolution.escalation_reason:
            await _trigger_escalation(session, conversation, message, resolution.escalation_reason)
        else:
            answer_text = await _generate_reply(
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

        await session.flush()
        return PipelineResult(message=message, order=None, answer_text=answer_text)
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
        await _trigger_escalation(session, conversation, message, "ai_call_failed")
        session.add(_usage_event(conversation.id, message.id, None, success=False, failed_tier="deepseek"))
        await session.flush()
        return PipelineResult(message=message, order=None)

    if usage is not None:
        session.add(_usage_event(conversation.id, message.id, usage, success=True))
    message.intent = classification.intent
    message.intent_confidence = classification.confidence
    message.model_tier = ModelTier.DEEPSEEK

    if reason:
        await _trigger_escalation(session, conversation, message, reason)
        # Never auto-reply after handing off to a human.
        await session.flush()
        return PipelineResult(message=message, order=None)

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
            await _trigger_escalation(session, conversation, message, "ai_call_failed")
            session.add(_usage_event(conversation.id, message.id, None, success=False, failed_tier="deepseek"))
            await session.flush()
            return PipelineResult(message=message, order=None)

        if extraction_usage is not None:
            session.add(_usage_event(conversation.id, message.id, extraction_usage, success=True))

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
            escalation_reason=extraction_reason,
            assign_order_number=False,
        )
        if extraction_reason and not message.escalation_reason:
            message.escalation_reason = extraction_reason

    answer_text = None
    if order is None:
        knowledge_matches = await knowledge_service.search(session, conversation.merchant_id, normalized_text)
        if knowledge_matches:
            prompt = (
                f"customer: {normalized_text}\n"
                f"store_info: {knowledge_matches[0]['content']}\n"
                "Answer the customer's question using store_info."
            )
        else:
            prompt = (
                f"customer: {normalized_text}\n"
                "No store_info is available. Respond naturally to the customer; "
                "if you cannot answer their question, say you will check and get back to them."
            )
        answer_text = await _generate_reply(
            session, conversation, message, merchant_name=merchant_name, user_prompt=prompt
        )

    await session.flush()
    return PipelineResult(message=message, order=order, answer_text=answer_text)
