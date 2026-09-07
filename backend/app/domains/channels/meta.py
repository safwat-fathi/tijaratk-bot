import hashlib
import hmac
import json
import logging

from app.core.config import settings
from app.domains.channels.schemas import ParsedInboundMessage
from app.models import Channel

logger = logging.getLogger(__name__)

_OBJECT_TO_CHANNEL = {
    "page": Channel.FACEBOOK,
    "instagram": Channel.INSTAGRAM,
}


def verify_meta_signature(raw_body: bytes, signature_header: str | None) -> bool:
    if not settings.META_APP_SECRET or not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(settings.META_APP_SECRET.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    provided = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, provided)


def _safe_json_payload(raw: str | None) -> dict | None:
    """Try to decode a JSON string from a postback/quick_reply payload."""
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except (json.JSONDecodeError, TypeError):
        return None


def parse_meta_payload(payload: dict) -> list[ParsedInboundMessage]:
    channel = _OBJECT_TO_CHANNEL.get(payload.get("object"))
    if channel is None:
        return []

    parsed: list[ParsedInboundMessage] = []
    for entry in payload.get("entry", []):
        page_id = entry.get("id")
        for event in entry.get("messaging", []):
            sender = event.get("sender")
            if not sender or not sender.get("id"):
                continue

            # --- Text messages (with optional quick_reply) ---
            message = event.get("message")
            if message and not message.get("is_echo"):
                text = message.get("text", "")
                mid = message.get("mid")
                if not mid:
                    continue

                # Quick reply payloads ride on message events
                qr = message.get("quick_reply")
                postback_payload = _safe_json_payload(qr.get("payload") if qr else None)

                # If this is a quick_reply with a payload but no meaningful
                # text (Facebook copies the button title into text), prefer
                # the title as text for display/history.
                if not text and qr:
                    text = qr.get("title", "")

                if not text and not postback_payload:
                    continue

                parsed.append(
                    ParsedInboundMessage(
                        channel=channel,
                        external_account_id=page_id,
                        external_customer_id=sender["id"],
                        external_message_id=mid,
                        text=text,
                        postback_payload=postback_payload,
                    )
                )
                continue

            # --- Postback events (button taps) ---
            postback = event.get("postback")
            if postback:
                title = postback.get("title", "")
                postback_payload = _safe_json_payload(postback.get("payload"))
                # Postbacks don't have a mid; use a synthetic dedup key.
                mid = postback.get("mid") or f"pb:{sender['id']}:{event.get('timestamp', '')}"

                text_to_display = title
                if postback_payload and isinstance(postback_payload, dict) and "_echo" in postback_payload:
                    text_to_display = postback_payload["_echo"]

                parsed.append(
                    ParsedInboundMessage(
                        channel=channel,
                        external_account_id=page_id,
                        external_customer_id=sender["id"],
                        external_message_id=mid,
                        text=text_to_display,
                        postback_payload=postback_payload,
                    )
                )
    return parsed

