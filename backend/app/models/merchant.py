from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Integer, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models._ids import new_id
from app.models.enums import MerchantStatus

if TYPE_CHECKING:
    from app.models.conversation import Conversation
    from app.models.product import Product
    from app.models.store_knowledge import StoreKnowledge


class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String, nullable=False)
    ai_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    ai_tool_ordering_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    auto_learning_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    currency: Mapped[str] = mapped_column(String, default="EGP", server_default="EGP")
    next_order_number: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    welcome_message: Mapped[str] = mapped_column(
        String,
        default="أهلاً بيك في {store_name}! 👋\nتحب تعمل إيه؟",
        server_default="أهلاً بيك في {store_name}! 👋\nتحب تعمل إيه؟",
    )
    status: Mapped[MerchantStatus] = mapped_column(
        SAEnum(MerchantStatus, name="merchantstatus"),
        nullable=False,
        default=MerchantStatus.ACTIVE,
        server_default="ACTIVE",
    )
    facebook_user_id: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)

    products: Mapped[list[Product]] = relationship(back_populates="merchant")
    conversations: Mapped[list[Conversation]] = relationship(back_populates="merchant")
    store_knowledge: Mapped[list[StoreKnowledge]] = relationship(back_populates="merchant")
