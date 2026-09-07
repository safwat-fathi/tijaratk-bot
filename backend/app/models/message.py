from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Float, ForeignKey, Index, String, func, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models._ids import new_id
from app.models.enums import Direction, ModelTier

if TYPE_CHECKING:
    from app.models.conversation import Conversation
    from app.models.order import Order


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_conversation_id_created_at", "conversation_id", "created_at"),
        Index(
            "ix_messages_external_message_id_unique",
            "external_message_id",
            unique=True,
            postgresql_where=text("external_message_id IS NOT NULL"),
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"), nullable=False)
    direction: Mapped[Direction] = mapped_column(SAEnum(Direction, name="direction"), nullable=False)
    raw_text: Mapped[str | None] = mapped_column(String, nullable=True)
    normalized_text: Mapped[str | None] = mapped_column(String, nullable=True)
    intent: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    intent_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_tier: Mapped[ModelTier | None] = mapped_column(SAEnum(ModelTier, name="modeltier"), nullable=True)
    escalation_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    external_message_id: Mapped[str | None] = mapped_column(String, nullable=True)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    clustered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Rich messaging fields
    message_type: Mapped[str | None] = mapped_column(String, nullable=True)
    rich_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    postback_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
    order: Mapped[Order] = relationship(back_populates="message")

