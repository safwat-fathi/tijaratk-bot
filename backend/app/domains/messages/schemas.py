from pydantic import BaseModel, Field


class MessageIngestRequest(BaseModel):
    conversation_id: str
    raw_text: str = Field(..., max_length=2000)
    normalized_text: str = Field(..., max_length=2000)


class OrderLineItem(BaseModel):
    product_name: str
    quantity: float
    notes: str | None = None
    product_id: str | None = None


class OrderDetail(BaseModel):
    id: str
    status: str
    confidence_score: float
    extracted_by_tier: str
    line_items: list[OrderLineItem]
    address: str | None = None
    phone: str | None = None
    payment_method: str | None = None
    ambiguous_fields: list[str]


class MessageIngestResponse(BaseModel):
    message_id: str
    intent: str | None
    intent_confidence: float | None
    model_tier: str | None
    escalation_reason: str | None
    order_id: str | None
    order_status: str | None
    order: OrderDetail | None = None
    answer_messages: list[dict] = Field(default_factory=list)

