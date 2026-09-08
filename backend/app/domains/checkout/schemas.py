from datetime import datetime

from pydantic import BaseModel, Field


class ManualOrderLineItem(BaseModel):
    product_id: str
    variant_id: str | None = None
    quantity: float = 1.0


class ManualOrderCreate(BaseModel):
    conversation_id: str
    line_items: list[ManualOrderLineItem] = Field(..., min_length=1)
    customer_name: str | None = None
    customer_phone: str | None = None
    delivery_address: str | None = None


class ManualOrderRead(BaseModel):
    id: str
    order_number: int | None
    status: str
    subtotal: float | None
    total: float | None


class OrderItemRead(BaseModel):
    id: str
    product_id: str | None
    variant_id: str | None
    name_snapshot: str
    variant_snapshot: str | None
    unit_price: float
    quantity: float


class OrderRead(BaseModel):
    id: str
    order_number: int | None
    status: str
    customer_name: str | None
    customer_phone: str | None
    delivery_address: str | None
    subtotal: float | None
    total: float | None
    created_at: datetime
    items: list[OrderItemRead] = []

    class Config:
        from_attributes = True


class OrderStatusUpdate(BaseModel):
    status: str
