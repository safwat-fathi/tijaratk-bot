import hashlib
import hmac
import json

from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from twilio.request_validator import RequestValidator

from app.core.config import settings
from app.core.database import get_db
from app.core.redis import get_arq_pool
from app.main import app
from app.models import Channel, ChannelConnection, Message, WebhookEvent


def _sign_meta(body: bytes) -> str:
    digest = hmac.new(settings.META_APP_SECRET.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def _messenger_body(mid: str, text: str) -> bytes:
    payload = {
        "object": "page",
        "entry": [
            {
                "id": "test-page-id",
                "time": 0,
                "messaging": [
                    {
                        "sender": {"id": "customer-1"},
                        "recipient": {"id": "test-page-id"},
                        "timestamp": 0,
                        "message": {"mid": mid, "text": text},
                    }
                ],
            }
        ],
    }
    return json.dumps(payload).encode("utf-8")


async def test_meta_get_verify_echoes_challenge(monkeypatch):
    monkeypatch.setattr(settings, "META_VERIFY_TOKEN", "test-verify-token")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/webhooks/meta",
            params={"hub.mode": "subscribe", "hub.verify_token": "test-verify-token", "hub.challenge": "12345"},
        )

    assert response.status_code == 200
    assert response.text == "12345"
    assert response.headers["content-type"].startswith("text/plain")


async def test_meta_get_verify_rejects_wrong_token(monkeypatch):
    monkeypatch.setattr(settings, "META_VERIFY_TOKEN", "test-verify-token")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/webhooks/meta",
            params={"hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "12345"},
        )

    assert response.status_code == 403


async def test_meta_post_rejects_invalid_signature(monkeypatch, db_session, fake_arq_pool):
    monkeypatch.setattr(settings, "META_APP_SECRET", "test-app-secret")

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_arq_pool] = lambda: fake_arq_pool
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/webhooks/meta",
                content=_messenger_body("mid.111", "hello"),
                headers={"X-Hub-Signature-256": "sha256=" + "0" * 64, "content-type": "application/json"},
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_arq_pool, None)

    assert response.status_code == 403
    assert not fake_arq_pool.enqueued


async def test_meta_post_creates_message_and_enqueues_job(monkeypatch, db_session, channel_connection, fake_arq_pool):
    monkeypatch.setattr(settings, "META_APP_SECRET", "test-app-secret")
    body = _messenger_body("mid.111", "hello")

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_arq_pool] = lambda: fake_arq_pool
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/webhooks/meta",
                content=body,
                headers={"X-Hub-Signature-256": _sign_meta(body), "content-type": "application/json"},
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_arq_pool, None)

    assert response.status_code == 200
    assert len(fake_arq_pool.enqueued) == 1
    function_name, args, _ = fake_arq_pool.enqueued[0]
    assert function_name == "process_channel_message"
    message = await db_session.get(Message, args[0])
    assert message.raw_text == "hello"

    events = (await db_session.execute(select(WebhookEvent).order_by(WebhookEvent.received_at.desc()))).scalars().all()
    assert len(events) >= 1
    assert events[0].processing_error is None


async def test_meta_post_duplicate_delivery_enqueues_again_for_worker_idempotency(
    monkeypatch, db_session, channel_connection, fake_arq_pool
):
    monkeypatch.setattr(settings, "META_APP_SECRET", "test-app-secret")
    body = _messenger_body("mid.111", "hello")

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_arq_pool] = lambda: fake_arq_pool
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = {"X-Hub-Signature-256": _sign_meta(body), "content-type": "application/json"}
            await client.post("/webhooks/meta", content=body, headers=headers)
            await client.post("/webhooks/meta", content=body, headers=headers)
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_arq_pool, None)

    assert len(fake_arq_pool.enqueued) == 2


async def test_meta_post_unparseable_body_still_returns_200(monkeypatch, db_session, fake_arq_pool):
    monkeypatch.setattr(settings, "META_APP_SECRET", "test-app-secret")
    body = b"not json"

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_arq_pool] = lambda: fake_arq_pool
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/webhooks/meta",
                content=body,
                headers={"X-Hub-Signature-256": _sign_meta(body), "content-type": "application/json"},
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_arq_pool, None)

    assert response.status_code == 200
    events = (await db_session.execute(select(WebhookEvent).order_by(WebhookEvent.received_at.desc()))).scalars().all()
    assert len(events) >= 1
    assert events[0].processing_error is not None


async def test_twilio_post_creates_message_and_enqueues_job(monkeypatch, db_session, merchant, fake_arq_pool):
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "test-auth-token")
    monkeypatch.setattr(settings, "TWILIO_WEBHOOK_URL", "http://test/webhooks/whatsapp/twilio")

    connection = ChannelConnection(
        merchant_id=merchant.id,
        channel=Channel.WHATSAPP,
        external_account_id="whatsapp:+14155238886",
    )
    db_session.add(connection)
    await db_session.flush()

    params = {
        "MessageSid": "SM111",
        "From": "whatsapp:+201234567890",
        "To": "whatsapp:+14155238886",
        "Body": "hello",
        "NumMedia": "0",
    }
    signature = RequestValidator("test-auth-token").compute_signature(settings.TWILIO_WEBHOOK_URL, params)

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_arq_pool] = lambda: fake_arq_pool
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/webhooks/whatsapp/twilio",
                data=params,
                headers={"X-Twilio-Signature": signature},
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_arq_pool, None)

    assert response.status_code == 200
    assert len(fake_arq_pool.enqueued) == 1


async def test_twilio_post_rejects_invalid_signature(monkeypatch, db_session, fake_arq_pool):
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "test-auth-token")
    monkeypatch.setattr(settings, "TWILIO_WEBHOOK_URL", "http://test/webhooks/whatsapp/twilio")

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_arq_pool] = lambda: fake_arq_pool
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/webhooks/whatsapp/twilio",
                data={
                    "MessageSid": "SM111",
                    "From": "whatsapp:+201234567890",
                    "To": "whatsapp:+14155238886",
                    "Body": "hi",
                },
                headers={"X-Twilio-Signature": "not-real"},
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_arq_pool, None)

    assert response.status_code == 403
    assert not fake_arq_pool.enqueued
