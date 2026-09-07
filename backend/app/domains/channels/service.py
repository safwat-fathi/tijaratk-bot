import logging
from datetime import UTC, datetime

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.channels.schemas import ParsedInboundMessage
from app.models import ChannelConnection, Conversation, ConvState, Direction, Message
from app.models._ids import new_id

logger = logging.getLogger(__name__)


async def _find_channel_connection(session: AsyncSession, parsed: ParsedInboundMessage) -> ChannelConnection | None:
    result = await session.execute(
        select(ChannelConnection).where(
            ChannelConnection.channel == parsed.channel,
            ChannelConnection.external_account_id == parsed.external_account_id,
            ChannelConnection.is_active.is_(True),
        )
    )
    return result.scalar_one_or_none()


async def _find_or_create_conversation(
    session: AsyncSession, channel_connection: ChannelConnection, customer_ref: str
) -> str:
    existing = await session.execute(
        select(Conversation.id).where(
            Conversation.channel_connection_id == channel_connection.id,
            Conversation.customer_ref == customer_ref,
        )
    )
    conversation_id = existing.scalar_one_or_none()
    if conversation_id is not None:
        return conversation_id

    now = datetime.now(UTC)
    insert_stmt = (
        pg_insert(Conversation)
        .values(
            id=new_id(),
            merchant_id=channel_connection.merchant_id,
            channel_connection_id=channel_connection.id,
            customer_ref=customer_ref,
            state=ConvState.NEW,
            slots={},
            last_message_at=now,
        )
        .on_conflict_do_nothing(
            index_elements=["channel_connection_id", "customer_ref"],
        )
        .returning(Conversation.id)
    )
    result = await session.execute(insert_stmt)
    conversation_id = result.scalar_one_or_none()
    if conversation_id is not None:
        return conversation_id

    # Lost the race to a concurrent webhook delivery for the same customer —
    # the row now exists, re-select it.
    existing = await session.execute(
        select(Conversation.id).where(
            Conversation.channel_connection_id == channel_connection.id,
            Conversation.customer_ref == customer_ref,
        )
    )
    return existing.scalar_one()


async def ingest_channel_message(session: AsyncSession, parsed: ParsedInboundMessage) -> str | None:
    channel_connection = await _find_channel_connection(session, parsed)
    if channel_connection is None:
        logger.warning(
            "unmapped_channel_account channel=%s external_account_id=%s",
            parsed.channel,
            parsed.external_account_id,
        )
        return None

    conversation_id = await _find_or_create_conversation(session, channel_connection, parsed.external_customer_id)

    insert_stmt = (
        pg_insert(Message)
        .values(
            id=new_id(),
            conversation_id=conversation_id,
            direction=Direction.INBOUND,
            raw_text=parsed.text,
            normalized_text=parsed.text,
            external_message_id=parsed.external_message_id,
            postback_payload=parsed.postback_payload,
        )
        .on_conflict_do_nothing(
            index_elements=["external_message_id"],
            index_where=text("external_message_id IS NOT NULL"),
        )
        .returning(Message.id)
    )
    result = await session.execute(insert_stmt)
    message_id = result.scalar_one_or_none()
    if message_id is not None:
        return message_id

    # Conflict hit; select the existing message
    existing = await session.execute(
        select(Message.id).where(Message.external_message_id == parsed.external_message_id)
    )
    return existing.scalar_one_or_none()
