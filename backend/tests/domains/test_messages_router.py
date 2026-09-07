from decimal import Decimal

import httpx
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.database import get_db
from app.domains.auth.dependencies import get_current_merchant
from app.main import app
from app.models import Merchant, Product, StoreKnowledge


def _chat_response(content: str) -> dict:
    return {
        "id": "chatcmpl-1",
        "object": "chat.completion",
        "created": 0,
        "model": "test",
        "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}],
    }


def _embedding_response() -> dict:
    return {
        "object": "list",
        "data": [{"object": "embedding", "index": 0, "embedding": [0.1] * 1024}],
        "model": "bge-m3",
        "usage": {"prompt_tokens": 1, "total_tokens": 1},
    }


async def test_ingest_returns_404_for_unknown_conversation(db_session, merchant, mock_ai):
    async def _override_get_db():
        yield db_session

    async def _override_get_current_merchant():
        return merchant

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_merchant] = _override_get_current_merchant
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/messages",
                json={"conversation_id": "does-not-exist", "raw_text": "hi", "normalized_text": "hi"},
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_merchant, None)
    assert response.status_code == 404


async def test_ingest_message_rejects_conversation_owned_by_different_merchant(db_session, conversation, mock_ai):
    # `conversation` belongs to the `merchant` fixture (merchant A). Simulate
    # a request authenticated as a different merchant (B) trying to post to
    # it - must 404, not 403 (no-existence-leak idiom), same as an unknown id.
    other_merchant = Merchant(name="Other Merchant")
    db_session.add(other_merchant)
    await db_session.flush()

    async def _override_get_db():
        yield db_session

    async def _override_get_current_merchant():
        return other_merchant

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_merchant] = _override_get_current_merchant
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/messages",
                json={"conversation_id": conversation.id, "raw_text": "hi", "normalized_text": "hi"},
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_merchant, None)
    assert response.status_code == 404


async def test_ingest_message_requires_authentication(db_session, conversation, monkeypatch):
    # Explicitly disable the dev bypass so this test isn't accidentally
    # green because of a locally-configured DEMO_API_KEY.
    monkeypatch.setattr(settings, "DEMO_API_KEY", "")

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/messages",
                json={"conversation_id": conversation.id, "raw_text": "hi", "normalized_text": "hi"},
            )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 401


async def test_ingest_tier0_short_circuit_end_to_end(db_session, merchant, conversation, mock_ai):
    # Override get_db to hand the app the SAME session/transaction the
    # `conversation` fixture used, so the request sees that uncommitted row
    # (a separate pooled connection would not) and the whole test still
    # rolls back cleanly via the db_session fixture's teardown.
    async def _override_get_db():
        yield db_session

    async def _override_get_current_merchant():
        return merchant

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_merchant] = _override_get_current_merchant
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/messages",
                json={"conversation_id": conversation.id, "raw_text": "👍", "normalized_text": "👍"},
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_merchant, None)

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "reaction"
    assert body["model_tier"] == "RULE"
    assert body["order_id"] is None


async def test_ingest_purchase_intent_returns_full_order_detail(db_session, merchant, conversation, mock_ai):
    # AUTO_CONFIRMED requires the line item to fully resolve (product found
    # AND priced) - a priced product must be seeded (Task 4), unlike before
    # when list-truthiness alone decided status.
    product = Product(
        merchant_id=conversation.merchant_id, name="Summer Linen Dress", embedding=[1.0] * 1024, price=Decimal("199.99")
    )
    db_session.add(product)
    await db_session.flush()

    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        side_effect=[
            httpx.Response(200, json=_chat_response('{"intent": "purchase_intent", "confidence": 0.9}')),
            httpx.Response(
                200,
                json=_chat_response(
                    '{"line_items": [{"product_name": "فستان صيفي", "quantity": 1.0}], '
                    '"address": "6 October City", "phone": "01012345678", '
                    '"ambiguous_fields": [], "confidence": 0.9}'
                ),
            ),
        ]
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    async def _override_get_db():
        yield db_session

    async def _override_get_current_merchant():
        return merchant

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_merchant] = _override_get_current_merchant
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/messages",
                json={
                    "conversation_id": conversation.id,
                    "raw_text": "عايز فستان صيفي",
                    "normalized_text": "عايز فستان صيفي",
                },
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_merchant, None)

    assert response.status_code == 200
    body = response.json()
    assert body["order"] is not None
    assert body["order"]["status"] == "AUTO_CONFIRMED"
    assert body["order"]["address"] == "6 October City"
    assert body["order"]["phone"] == "01012345678"
    assert body["order"]["line_items"][0]["product_id"] == product.id


async def test_ingest_question_returns_answer_messages(db_session, merchant, conversation, mock_ai):
    db_session.add(
        StoreKnowledge(
            merchant_id=conversation.merchant_id,
            knowledge_type="shipping",
            title="سياسة الشحن",
            content="بنشحن لكل محافظات مصر خلال يومين لأربعة أيام.",
            keywords=["شحن"],
        )
    )
    await db_session.flush()

    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        side_effect=[
            httpx.Response(200, json=_chat_response('{"intent": "question", "confidence": 0.9}')),
            httpx.Response(200, json=_chat_response('{"reply": "بنشحن لكل محافظات مصر خلال يومين لأربعة أيام."}')),
        ]
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    async def _override_get_db():
        yield db_session

    async def _override_get_current_merchant():
        return merchant

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_merchant] = _override_get_current_merchant
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/messages",
                json={
                    "conversation_id": conversation.id,
                    "raw_text": "بتشحنوا فين؟",
                    "normalized_text": "بتشحنوا فين؟",
                },
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_merchant, None)

    assert response.status_code == 200
    assert response.json()["answer_messages"][0]["text"] == "بنشحن لكل محافظات مصر خلال يومين لأربعة أيام."
