from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.database import get_db
from app.main import app
from app.models import Conversation, Merchant, Product, StoreKnowledge


async def test_demo_router_returns_503_if_merchant_not_configured(monkeypatch, db_session):
    monkeypatch.setattr(settings, "DEMO_STOPGAP_MERCHANT_ID", "")
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/demo/conversations/")
            assert response.status_code == 503
            assert "not configured" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_db, None)


async def test_demo_router_conversations_returns_merchants_conversations(
    db_session, merchant: Merchant, conversation: Conversation, monkeypatch
):
    monkeypatch.setattr(settings, "DEMO_STOPGAP_MERCHANT_ID", merchant.id)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/demo/conversations/")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["id"] == conversation.id
    finally:
        app.dependency_overrides.pop(get_db, None)


async def test_demo_router_products_returns_merchants_products(
    db_session, merchant: Merchant, monkeypatch
):
    monkeypatch.setattr(settings, "DEMO_STOPGAP_MERCHANT_ID", merchant.id)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    product = Product(
        merchant_id=merchant.id,
        name="Test Product",
        price=10.0,
    )
    db_session.add(product)
    await db_session.flush()

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/demo/products/")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["id"] == product.id
    finally:
        app.dependency_overrides.pop(get_db, None)


async def test_demo_router_knowledge_returns_merchants_knowledge(
    db_session, merchant: Merchant, monkeypatch
):
    monkeypatch.setattr(settings, "DEMO_STOPGAP_MERCHANT_ID", merchant.id)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    knowledge = StoreKnowledge(
        merchant_id=merchant.id,
        knowledge_type="shipping",
        title="Shipping",
        content="We ship worldwide.",
    )
    db_session.add(knowledge)
    await db_session.flush()

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/demo/knowledge/")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["id"] == knowledge.id
    finally:
        app.dependency_overrides.pop(get_db, None)


async def test_demo_router_post_message_ingests_message(
    db_session, merchant: Merchant, conversation: Conversation, monkeypatch
):
    monkeypatch.setattr(settings, "DEMO_STOPGAP_MERCHANT_ID", merchant.id)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)

    payload = {
        "conversation_id": conversation.id,
        "raw_text": "Hello bot",
        "normalized_text": "hello bot",
    }

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/demo/messages/", json=payload)
            assert response.status_code in (200, 202)
            data = response.json()
            assert "message_id" in data
    finally:
        app.dependency_overrides.pop(get_db, None)
