"""Facebook Messenger Send API renderer.

Converts channel-neutral OutboundMessage instances into the JSON payloads
expected by the Facebook Graph API v26.0 Send API.
"""

from __future__ import annotations

from app.domains.messaging.models import (
    ButtonMessage,
    GenericTemplateMessage,
    MediaMessage,
    OutboundMessage,
    QuickReplyMessage,
    ReceiptMessage,
    TextMessage,
    serialize_payload,
)


class FacebookRenderer:
    """Stateless renderer: OutboundMessage → Facebook Send API ``message`` dict."""

    def render(self, msg: OutboundMessage) -> dict:
        """Dispatch to the appropriate render method based on message kind."""
        renderer = _RENDERERS.get(msg.kind)
        if renderer is None:
            raise ValueError(f"unsupported message kind: {msg.kind!r}")
        return renderer(msg)

    # -- individual renderers ------------------------------------------------

    @staticmethod
    def _render_text(msg: TextMessage) -> dict:
        return {"text": msg.text}

    @staticmethod
    def _render_quick_reply(msg: QuickReplyMessage) -> dict:
        return {
            "text": msg.text,
            "quick_replies": [
                {
                    "content_type": "text",
                    "title": qr.title,
                    "payload": serialize_payload(qr.payload),
                }
                for qr in msg.quick_replies
            ],
        }

    @staticmethod
    def _render_button(msg: ButtonMessage) -> dict:
        return {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "button",
                    "text": msg.text,
                    "buttons": [_render_button_element(b) for b in msg.buttons],
                },
            }
        }

    @staticmethod
    def _render_generic_template(msg: GenericTemplateMessage) -> dict:
        elements = []
        for el in msg.elements:
            element: dict = {"title": el.title}
            if el.subtitle:
                element["subtitle"] = el.subtitle
            if el.image_url:
                element["image_url"] = el.image_url
            if el.buttons:
                element["buttons"] = [_render_button_element(b) for b in el.buttons]
            elements.append(element)
        return {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": elements,
                },
            }
        }

    @staticmethod
    def _render_media(msg: MediaMessage) -> dict:
        return {
            "attachment": {
                "type": msg.media_type,
                "payload": {
                    "url": msg.url,
                    "is_reusable": True,
                },
            }
        }

    @staticmethod
    def _render_receipt(msg: ReceiptMessage) -> dict:
        elements = []
        for item in msg.items:
            el: dict = {
                "title": item.title,
                "quantity": item.quantity,
                "price": item.price,
                "currency": msg.currency,
            }
            if item.subtitle:
                el["subtitle"] = item.subtitle
            if item.image_url:
                el["image_url"] = item.image_url
            elements.append(el)

        summary: dict = {"total_cost": msg.summary.total_cost}
        if msg.summary.subtotal is not None:
            summary["subtotal"] = msg.summary.subtotal
        if msg.summary.shipping_cost is not None:
            summary["shipping_cost"] = msg.summary.shipping_cost

        payload: dict = {
            "template_type": "receipt",
            "recipient_name": msg.recipient_name,
            "order_number": msg.order_number,
            "currency": msg.currency,
            "payment_method": msg.payment_method,
            "elements": elements,
            "summary": summary,
        }

        if msg.address:
            payload["address"] = {
                "street_1": msg.address,
                "city": "",
                "postal_code": "",
                "state": "",
                "country": "EG",
            }

        return {
            "attachment": {
                "type": "template",
                "payload": payload,
            }
        }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _render_button_element(b) -> dict:
    """Convert a Button model into a Facebook button dict."""
    if b.type == "web_url":
        return {
            "type": "web_url",
            "title": b.title,
            "url": b.url or "",
        }
    return {
        "type": "postback",
        "title": b.title,
        "payload": serialize_payload(b.payload or {}),
    }


# Dispatch table — avoids if/elif chains and makes it easy to add new kinds.
_RENDERERS: dict[str, callable] = {
    "text": FacebookRenderer._render_text,
    "quick_reply": FacebookRenderer._render_quick_reply,
    "button": FacebookRenderer._render_button,
    "generic_template": FacebookRenderer._render_generic_template,
    "media": FacebookRenderer._render_media,
    "receipt": FacebookRenderer._render_receipt,
}
