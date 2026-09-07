from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.domains.auth.dependencies import get_current_merchant
from app.domains.auth.meta_client import fetch_user_pages, is_page_access_token_valid, verify_facebook_access_token
from app.domains.auth.schemas import AuthTokenResponse, FacebookCallbackRequest
from app.domains.auth.service import find_or_create_merchant_by_facebook_id, provision_channel_connections
from app.domains.auth.tokens import create_access_token
from app.models import Channel, ChannelConnection, MerchantStatus

router = APIRouter()


@router.post("/facebook/callback", response_model=AuthTokenResponse)
async def facebook_callback(body: FacebookCallbackRequest, db: AsyncSession = Depends(get_db)) -> AuthTokenResponse:
    identity = await verify_facebook_access_token(body.access_token)
    if identity is None:
        raise HTTPException(status_code=401, detail="invalid facebook access token")

    merchant = await find_or_create_merchant_by_facebook_id(db, identity)
    if merchant.status != MerchantStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="merchant suspended")

    # Fetch the user's FB pages and provision channel connections
    pages = await fetch_user_pages(body.access_token)
    pages_connected, conflicts = await provision_channel_connections(db, merchant.id, pages)

    await db.commit()

    token = create_access_token(merchant.id)
    return AuthTokenResponse(
        access_token=token,
        merchant_id=merchant.id,
        merchant_name=merchant.name,
        pages_connected=pages_connected,
        conflicted_pages=conflicts,
    )


class ConnectedChannel(BaseModel):
    channel: str
    account_name: str | None


class MeResponse(BaseModel):
    merchant_id: str
    merchant_name: str
    is_active: bool
    channels: list[ConnectedChannel] = []


@router.get("/me", response_model=MeResponse)
async def get_me(merchant=Depends(get_current_merchant), db: AsyncSession = Depends(get_db)) -> MeResponse:
    """Return the currently authenticated merchant based on JWT token."""
    result = await db.execute(
        select(ChannelConnection).where(
            ChannelConnection.merchant_id == merchant.id, ChannelConnection.is_active.is_(True)
        )
    )
    connections = result.scalars().all()

    return MeResponse(
        merchant_id=merchant.id,
        merchant_name=merchant.name,
        is_active=(merchant.status == MerchantStatus.ACTIVE),
        channels=[
            ConnectedChannel(channel=c.channel.value, account_name=str(c.account_name) if c.account_name else None)
            for c in connections
        ],
    )


@router.get("/me/verify-tokens")
async def verify_tokens(merchant=Depends(get_current_merchant), db: AsyncSession = Depends(get_db)):
    """Verify Facebook page tokens in the background."""
    result = await db.execute(
        select(ChannelConnection).where(
            ChannelConnection.merchant_id == merchant.id, ChannelConnection.is_active.is_(True)
        )
    )
    connections = result.scalars().all()

    valid_connections = []
    invalid_connections = []

    for c in connections:
        if c.channel == Channel.FACEBOOK and c.page_access_token:
            is_valid = await is_page_access_token_valid(c.page_access_token)
            if not is_valid:
                c.is_active = False
                invalid_connections.append(c)
                continue
        valid_connections.append(c)

    if invalid_connections:
        await db.commit()

    if connections and not valid_connections:
        raise HTTPException(status_code=401, detail="Facebook token expired. Please log in again.")

    return {"status": "ok"}
