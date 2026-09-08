import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.domains.auth.dependencies import get_current_merchant
from app.domains.auth.tokens import create_access_token
from app.models import Merchant
from app.models.enums import MerchantStatus


def _bearer(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


async def test_get_current_merchant_valid_token_returns_merchant(db_session, merchant):
    token = create_access_token(merchant.id)

    result = await get_current_merchant(credentials=_bearer(token), db=db_session)

    assert result.id == merchant.id


async def test_get_current_merchant_missing_token_raises_401(db_session):
    with pytest.raises(HTTPException) as exc_info:
        await get_current_merchant(credentials=None, db=db_session)

    assert exc_info.value.status_code == 401


async def test_get_current_merchant_invalid_token_raises_401(db_session):
    with pytest.raises(HTTPException) as exc_info:
        await get_current_merchant(credentials=_bearer("not-a-real-token"), db=db_session)

    assert exc_info.value.status_code == 401


async def test_get_current_merchant_suspended_merchant_raises_403(db_session):
    suspended = Merchant(name="Suspended Merchant", status=MerchantStatus.SUSPENDED)
    db_session.add(suspended)
    await db_session.flush()
    token = create_access_token(suspended.id)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_merchant(credentials=_bearer(token), db=db_session)

    assert exc_info.value.status_code == 403
