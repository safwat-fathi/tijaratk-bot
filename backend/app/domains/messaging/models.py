"""Channel-neutral outbound message types.

Business logic builds these; a per-channel renderer converts them into
the channel's native format (Facebook Send API JSON, WhatsApp interactive
message JSON, etc.).
"""

from __future__ import annotations

import json
from typing import Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Supporting types
# ---------------------------------------------------------------------------


class QuickReply(BaseModel):
    """A single quick-reply chip (text + machine-readable payload)."""

    title: str = Field(max_length=20, description="Displayed label (Facebook caps at 20 chars)")
    payload: dict = Field(default_factory=dict, description="Structured JSON sent back on tap")


class Button(BaseModel):
    """A tappable button — either a postback (in-chat action) or a web URL."""

    type: Literal["postback", "web_url"] = "postback"
    title: str = Field(max_length=20, description="Button label (Facebook caps at 20 chars)")
    payload: dict | None = Field(default=None, description="Postback JSON (postback buttons only)")
    url: str | None = Field(default=None, description="URL to open (web_url buttons only)")


class GenericElement(BaseModel):
    """One card inside a Generic Template carousel."""

    title: str = Field(max_length=80)
    subtitle: str | None = Field(default=None, max_length=80)
    image_url: str | None = None
    buttons: list[Button] = Field(default_factory=list, max_length=3)


class ReceiptItem(BaseModel):
    """One line item inside a Receipt Template."""

    title: str
    subtitle: str | None = None
    quantity: float = 1
    price: float = 0
    image_url: str | None = None


class ReceiptSummary(BaseModel):
    """Totals block for a Receipt Template."""

    subtotal: float | None = None
    shipping_cost: float | None = None
    total_cost: float


# ---------------------------------------------------------------------------
# Outbound message types — each maps 1:1 to a renderer method
# ---------------------------------------------------------------------------


class OutboundMessage(BaseModel):
    """Base class for all outbound messages."""

    kind: str  # discriminator — set by each subclass

    def text_fallback(self) -> str:
        """Human-readable fallback for persistence / dashboard display."""
        return ""


class TextMessage(OutboundMessage):
    kind: Literal["text"] = "text"
    text: str

    def text_fallback(self) -> str:
        return self.text


class QuickReplyMessage(OutboundMessage):
    kind: Literal["quick_reply"] = "quick_reply"
    text: str
    quick_replies: list[QuickReply] = Field(max_length=13)

    def text_fallback(self) -> str:
        chips = " | ".join(qr.title for qr in self.quick_replies)
        return f"{self.text}\n[{chips}]"


class ButtonMessage(OutboundMessage):
    kind: Literal["button"] = "button"
    text: str
    buttons: list[Button] = Field(max_length=3)

    def text_fallback(self) -> str:
        labels = " | ".join(b.title for b in self.buttons)
        return f"{self.text}\n[{labels}]"


class GenericTemplateMessage(OutboundMessage):
    kind: Literal["generic_template"] = "generic_template"
    elements: list[GenericElement] = Field(max_length=10)

    def text_fallback(self) -> str:
        titles = ", ".join(e.title for e in self.elements)
        return f"[{len(self.elements)} cards: {titles}]"


class MediaMessage(OutboundMessage):
    kind: Literal["media"] = "media"
    media_type: Literal["image", "video"] = "image"
    url: str

    def text_fallback(self) -> str:
        return f"[{self.media_type}: {self.url}]"


class ReceiptMessage(OutboundMessage):
    kind: Literal["receipt"] = "receipt"
    recipient_name: str
    order_number: str
    currency: str = "EGP"
    payment_method: str = "الدفع عند الاستلام"
    items: list[ReceiptItem] = Field(default_factory=list)
    summary: ReceiptSummary
    address: str | None = None

    def text_fallback(self) -> str:
        return f"إيصال الطلب #{self.order_number} — {self.summary.total_cost} {self.currency}"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def serialize_payload(payload: dict) -> str:
    """Encode a postback/quick_reply payload dict to a JSON string
    suitable for Facebook's 1000-char payload limit."""
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
