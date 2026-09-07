"""Multi-message sender for Facebook Messenger.

Replaces the original single-text ``send_facebook_reply`` with a
renderer-aware sender that can deliver any ``OutboundMessage`` type
via the Facebook Graph API v26.0 Send API.
"""

from __future__ import annotations

import logging

import httpx

from app.domains.messaging.models import OutboundMessage
from app.domains.messaging.renderer import FacebookRenderer

_SEND_API_URL = "https://graph.facebook.com/v26.0/me/messages"
_HTTP_TIMEOUT_SECONDS = 10.0

logger = logging.getLogger(__name__)

_fb_renderer = FacebookRenderer()


async def send_facebook_messages(
    page_access_token: str,
    recipient_id: str,
    messages: list[OutboundMessage],
) -> list[bool]:
    """Send a sequence of rich messages to a Facebook/Messenger user.

    Returns a list of booleans, one per message, indicating success/failure.
    Failures are logged but never raised — the caller decides how to handle
    partial delivery.
    """
    results: list[bool] = []
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_SECONDS) as client:
        for msg in messages:
            try:
                fb_message = _fb_renderer.render(msg)
            except (ValueError, KeyError) as exc:
                logger.warning("fb_render_failed kind=%s error=%s", msg.kind, exc)
                results.append(False)
                continue

            ok = await _send_single(client, page_access_token, recipient_id, fb_message)
            results.append(ok)
    return results


async def _send_single(
    client: httpx.AsyncClient,
    page_access_token: str,
    recipient_id: str,
    fb_message: dict,
) -> bool:
    """POST a single rendered message to the Facebook Send API."""
    try:
        response = await client.post(
            _SEND_API_URL,
            params={"access_token": page_access_token},
            json={
                "recipient": {"id": recipient_id},
                "message": fb_message,
                "messaging_type": "RESPONSE",
            },
        )
        if response.status_code != 200:
            logger.warning("fb_send_failed status=%s body=%s", response.status_code, response.text)
            return False
        return True
    except httpx.HTTPError as exc:
        logger.warning("fb_send_error error=%s", exc)
        return False
