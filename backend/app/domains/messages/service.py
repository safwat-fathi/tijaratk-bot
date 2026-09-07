from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.messages.schemas import (
    MessageIngestRequest,
    MessageIngestResponse,
    OrderDetail,
    OrderLineItem,
)
from app.engine.pipeline import process_message
from app.models import Conversation, Direction, Message
from app.models._ids import new_id


class ConversationNotFoundError(Exception):
    pass


async def ingest_message(db: AsyncSession, payload: MessageIngestRequest, merchant_id: str) -> MessageIngestResponse:
    conversation = await db.get(Conversation, payload.conversation_id)
    if conversation is None or conversation.merchant_id != merchant_id:
        raise ConversationNotFoundError(payload.conversation_id)

    message = Message(
        id=new_id(),
        conversation_id=conversation.id,
        direction=Direction.INBOUND,
        raw_text=payload.raw_text,
        normalized_text=payload.normalized_text,
    )
    result = await process_message(db, conversation, message)

    order_detail = None
    if result.order is not None:
        extracted = result.order.extracted_payload
        order_detail = OrderDetail(
            id=result.order.id,
            status=result.order.status.value,
            confidence_score=result.order.confidence_score,
            extracted_by_tier=result.order.extracted_by_tier.value,
            line_items=[OrderLineItem(**item) for item in extracted["line_items"]],
            address=extracted.get("address"),
            phone=extracted.get("phone"),
            payment_method=extracted.get("payment_method"),
            ambiguous_fields=extracted.get("ambiguous_fields", []),
        )

    return MessageIngestResponse(
        message_id=result.message.id,
        intent=result.message.intent,
        intent_confidence=result.message.intent_confidence,
        model_tier=result.message.model_tier.value if result.message.model_tier else None,
        escalation_reason=result.message.escalation_reason,
        order_id=result.order.id if result.order else None,
        order_status=result.order.status.value if result.order else None,
        order=order_detail,
        answer_messages=[msg.model_dump(mode="json") for msg in result.messages],
    )

