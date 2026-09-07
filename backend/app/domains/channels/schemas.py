from dataclasses import dataclass, field

from app.models import Channel


@dataclass
class ParsedInboundMessage:
    channel: Channel
    external_account_id: str
    external_customer_id: str
    external_message_id: str
    text: str
    postback_payload: dict | None = field(default=None)

