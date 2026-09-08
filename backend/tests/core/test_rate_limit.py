from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.main import app

# To test the rate limit without mocking redis, we'll hit the /demo/ endpoints
# We need to monkeypatch settings.RATE_LIMIT_DEMO_MAX

async def test_demo_rate_limit_enforcement(monkeypatch, db_session, merchant):
    monkeypatch.setattr(settings, "DEMO_STOPGAP_MERCHANT_ID", merchant.id)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEMO_MAX", 2)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEMO_WINDOW", 60)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Request 1
        resp1 = await client.get("/demo/conversations/", headers={"X-Forwarded-For": "1.2.3.4"})
        assert resp1.status_code == 200

        # Request 2
        resp2 = await client.get("/demo/products/", headers={"X-Forwarded-For": "1.2.3.4"})
        assert resp2.status_code == 200

        # Request 3 should be rate limited
        resp3 = await client.get("/demo/knowledge/", headers={"X-Forwarded-For": "1.2.3.4"})
        assert resp3.status_code == 429

        # Request from another IP should succeed
        resp4 = await client.get("/demo/conversations/", headers={"X-Forwarded-For": "5.6.7.8"})
        assert resp4.status_code == 200

async def test_rate_limit_bypassed_when_disabled(monkeypatch, db_session, merchant):
    monkeypatch.setattr(settings, "DEMO_STOPGAP_MERCHANT_ID", merchant.id)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEMO_MAX", 1)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Request 1
        resp1 = await client.get("/demo/conversations/", headers={"X-Forwarded-For": "1.1.1.1"})
        assert resp1.status_code == 200

        # Request 2 should NOT be rate limited
        resp2 = await client.get("/demo/products/", headers={"X-Forwarded-For": "1.1.1.1"})
        assert resp2.status_code == 200
