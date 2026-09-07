import httpx

from app.engine.action_resolution import resolve_action
from app.models.product import Product
from app.models.store_knowledge import StoreKnowledge


def _chat_response(content: str) -> dict:
    return {
        "id": "chatcmpl-1",
        "object": "chat.completion",
        "created": 0,
        "model": "test",
        "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}],
    }


async def test_resolve_action_executes_search_products(db_session, merchant, conversation, message, mock_ai):
    db_session.add(Product(id="p1", merchant_id=merchant.id, name="Blue Shirt", aliases=[]))
    await db_session.flush()

    mock_ai.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=httpx.Response(
            200,
            json=_chat_response('{"action": "search_products", "query": "shirt", "filters": {}, "confidence": 0.92}'),
        )
    )

    resolution = await resolve_action(db_session, conversation, message)
    print("RESOLUTION:", resolution)

    assert resolution.outcome.status == "executed"
    assert resolution.escalation_reason is None
    assert "Blue Shirt" in resolution.response_text


async def test_resolve_action_escalates_on_rejected_action(db_session, merchant, conversation, message, mock_ai):
    mock_ai.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=httpx.Response(
            200, json=_chat_response('{"action": "get_product", "product_id": "does-not-exist", "confidence": 0.9}')
        )
    )

    resolution = await resolve_action(db_session, conversation, message)

    assert resolution.outcome.status == "rejected"
    assert resolution.escalation_reason == "action_rejected:product_not_found"


async def test_resolve_action_executes_search_store_knowledge_with_no_matches(
    db_session, merchant, conversation, message, mock_ai
):
    # search_store_knowledge now runs for real (store_knowledge.service.search,
    # a keyword-match MVP) instead of always raising ToolUnavailableError. With
    # no StoreKnowledge rows seeded for this merchant it returns zero matches
    # and still executes successfully.
    mock_ai.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=httpx.Response(
            200, json=_chat_response('{"action": "search_store_knowledge", "query": "test", "confidence": 0.9}')
        )
    )

    resolution = await resolve_action(db_session, conversation, message)

    assert resolution.outcome.status == "executed"
    assert resolution.escalation_reason is None
    assert resolution.response_text == "لم أتمكن من العثور على أي معلومات حول ذلك."


async def test_resolve_action_returns_knowledge_content_on_match(db_session, merchant, conversation, message, mock_ai):
    db_session.add(
        StoreKnowledge(
            merchant_id=merchant.id,
            knowledge_type="general",
            title="ساعات العمل",
            content="فريق خدمة العملاء متاح من السبت إلى الخميس، من 10 صباحاً حتى 10 مساءً.",
            keywords=["مواعيد العمل"],
        )
    )
    await db_session.flush()

    mock_ai.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=httpx.Response(
            200,
            json=_chat_response(
                '{"action": "search_store_knowledge", "query": "ايه هي مواعيد العمل؟", "confidence": 0.9}'
            ),
        )
    )

    resolution = await resolve_action(db_session, conversation, message)

    assert resolution.outcome.status == "executed"
    assert resolution.response_text == "فريق خدمة العملاء متاح من السبت إلى الخميس، من 10 صباحاً حتى 10 مساءً."


async def test_resolve_action_escalates_on_invalid_json_after_retry(
    db_session, merchant, conversation, message, mock_ai
):
    mock_ai.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=httpx.Response(200, json=_chat_response("not valid json"))
    )

    resolution = await resolve_action(db_session, conversation, message)

    assert resolution.proposed_action is None
    assert resolution.escalation_reason == "ai_call_failed"
