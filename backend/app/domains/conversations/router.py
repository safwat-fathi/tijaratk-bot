from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.domains.auth.dependencies import get_current_merchant
from app.domains.conversations.schemas import ConversationRead, MessageRead, ReplyRequest
from app.domains.conversations.service import get_conversation_messages, list_conversations
from app.domains.messaging.models import TextMessage
from app.domains.messaging.sender import send_facebook_messages
from app.models import Channel, ChannelConnection, Conversation, Direction, Merchant, Message
from app.models._ids import new_id

router = APIRouter()


@router.get("/", response_model=list[ConversationRead])
async def get_conversations(
    current_merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)
) -> list[ConversationRead]:
    return await list_conversations(db, current_merchant.id)


@router.get("/{conversation_id}/messages", response_model=list[MessageRead])
async def get_messages(
    conversation_id: str,
    current_merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> list[MessageRead]:
    messages = await get_conversation_messages(db, current_merchant.id, conversation_id)
    if messages is None:
        raise HTTPException(status_code=404, detail="conversation not found")
    return messages


@router.post("/{conversation_id}/reply", status_code=201)
async def reply_to_conversation(
    conversation_id: str,
    payload: ReplyRequest,
    current_merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> dict:
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None or conversation.merchant_id != current_merchant.id:
        raise HTTPException(status_code=404, detail="conversation not found")

    # Persist the outbound message
    msg_model = TextMessage(text=payload.text)
    outbound = Message(
        id=new_id(),
        conversation_id=conversation.id,
        direction=Direction.OUTBOUND,
        raw_text=msg_model.text_fallback(),
        normalized_text=msg_model.text_fallback(),
        message_type=msg_model.kind,
        rich_payload=msg_model.model_dump(mode="json"),
    )
    db.add(outbound)

    # Send via channel if connected
    sent = False
    if conversation.channel_connection_id:
        connection = await db.get(ChannelConnection, conversation.channel_connection_id)
        if connection and connection.page_access_token and connection.channel == Channel.FACEBOOK:
            results = await send_facebook_messages(
                connection.page_access_token,
                conversation.customer_ref,
                [msg_model],
            )
            if results:
                sent = results[0]

    await db.commit()
    return {"message_id": outbound.id, "sent": sent}
