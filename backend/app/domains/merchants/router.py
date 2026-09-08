from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.domains.auth.dependencies import get_current_merchant
from app.models import Merchant

router = APIRouter()


class MerchantSettingsUpdate(BaseModel):
    auto_learning_enabled: bool | None = None
    welcome_message: str | None = None


class MerchantSettingsRead(BaseModel):
    auto_learning_enabled: bool
    welcome_message: str


@router.get("/me/settings", response_model=MerchantSettingsRead)
async def get_settings(
    current_merchant: Merchant = Depends(get_current_merchant),
) -> MerchantSettingsRead:
    return MerchantSettingsRead(
        auto_learning_enabled=current_merchant.auto_learning_enabled,
        welcome_message=current_merchant.welcome_message,
    )


@router.patch("/me/settings", response_model=MerchantSettingsRead)
async def update_settings(
    payload: MerchantSettingsUpdate,
    current_merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> MerchantSettingsRead:
    if payload.auto_learning_enabled is not None:
        current_merchant.auto_learning_enabled = payload.auto_learning_enabled
    if payload.welcome_message is not None:
        current_merchant.welcome_message = payload.welcome_message
    await db.commit()
    return MerchantSettingsRead(
        auto_learning_enabled=current_merchant.auto_learning_enabled,
        welcome_message=current_merchant.welcome_message,
    )
