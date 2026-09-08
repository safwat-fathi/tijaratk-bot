from datetime import UTC, datetime

from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.domains.auth.dependencies import get_current_merchant
from app.main import app
from app.models import Conversation, ConvState, Merchant


async def test_list_conversations_filters_by_merchant_id(db_session, merchant, conversation):
    other_merchant = Merchant(name="Other Merchant")
    db_session.add(other_merchant)
    await db_session.flush()
    other_conversation = Conversation(
        merchant_id=other_merchant.id,
        customer_ref="other-customer",
        state=ConvState.NEW,
        slots={},
        last_message_at=datetime.now(UTC),
    )
    db_session.add(other_conversation)
    await db_session.flush()

    async def _override_get_db():
        yield db_session

    async def _override_get_current_merchant():
        return merchant

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_merchant] = _override_get_current_merchant
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/conversations/")
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_merchant, None)

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == conversation.id
    assert body[0]["merchant_id"] == merchant.id

async def test_get_conversations_requires_authentication(db_session):
    from httpx import ASGITransport, AsyncClient

    from app.core.database import get_db
    from app.main import app

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/conversations/")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 401
