import logging
from collections.abc import Callable
from contextlib import AbstractAsyncContextManager
from functools import partial

from arq import cron
from arq.connections import RedisSettings
from sqlalchemy.ext.asyncio import AsyncSession

from app.clustering.job import run_clustering
from app.core.config import settings
from app.core.database import async_session_maker
from app.core.locks import conversation_lock
from app.domains.messaging.models import OutboundMessage, TextMessage
from app.domains.messaging.sender import send_facebook_messages
from app.engine.pipeline import process_message
from app.models import Channel, ChannelConnection, Conversation, Direction, Message
from app.models._ids import new_id

logger = logging.getLogger(__name__)


async def _send_outbound(
    session: AsyncSession, conversation: Conversation, outbound_messages: list[OutboundMessage]
) -> None:
    """Send rich messages via the channel and persist each outbound message."""
    if not outbound_messages or not conversation.channel_connection_id:
        return

    connection = await session.get(ChannelConnection, conversation.channel_connection_id)
    if connection is None or not connection.page_access_token:
        logger.warning("no_page_token conversation_id=%s", conversation.id)
        return

    if connection.channel == Channel.FACEBOOK:
        results = await send_facebook_messages(
            connection.page_access_token,
            conversation.customer_ref,
            outbound_messages,
        )
        for msg, sent in zip(outbound_messages, results):
            if sent:
                session.add(
                    Message(
                        id=new_id(),
                        conversation_id=conversation.id,
                        direction=Direction.OUTBOUND,
                        raw_text=msg.text_fallback(),
                        normalized_text=msg.text_fallback(),
                        message_type=msg.kind,
                        rich_payload=msg.model_dump(mode="json"),
                    )
                )
        await session.flush()


async def _process_channel_message(
    session: AsyncSession,
    lock_cm: Callable[[str], AbstractAsyncContextManager[None]],
    message_id: str,
) -> None:
    message = await session.get(Message, message_id)
    if message is None or message.intent is not None:
        return
    conversation = await session.get(Conversation, message.conversation_id)
    async with lock_cm(conversation.id):
        result = await process_message(session, conversation, message)

        # Send outbound messages if the pipeline produced any
        outbound = result.messages
        if not outbound and result.order is not None:
            # Fallback: if pipeline produced an order but no messages (shouldn't happen),
            # send a deterministic order confirmation
            order_display = result.order.order_number or result.order.id[:8]
            outbound = [TextMessage(text=f"تم استلام طلبك #{order_display}. هنتواصل معاك قريب!")]

        if outbound:
            await _send_outbound(session, conversation, outbound)

        await session.commit()


async def process_channel_message(ctx: dict, message_id: str) -> None:
    async with async_session_maker() as session:
        lock_cm = partial(conversation_lock, ctx["redis"])
        await _process_channel_message(session, lock_cm, message_id)


async def run_auto_learning(ctx: dict) -> int:
    async with async_session_maker() as session:
        created = await run_clustering(session)
        await session.commit()
    logger.info("auto_learning_run created=%d", created)
    return created


class WorkerSettings:
    functions = [process_channel_message]
    cron_jobs = [cron(run_auto_learning, hour=3, minute=0)]
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)

