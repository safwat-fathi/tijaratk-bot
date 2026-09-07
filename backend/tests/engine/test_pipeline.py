import json
from decimal import Decimal

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.engine.pipeline import DEFAULT_INTENTS, _known_intents, process_message
from app.models import (
    AIUsageEvent,
    Conversation,
    ConvState,
    Direction,
    LabeledExample,
    Merchant,
    Message,
    ModelTier,
    OrderItem,
    OrderStatus,
    Product,
    StoreKnowledge,
)
from app.models._ids import new_id
from app.models.product_variant import ProductVariant


def _inbound_message(conversation, raw_text: str, normalized_text: str) -> Message:
    return Message(
        id=new_id(),
        conversation_id=conversation.id,
        direction=Direction.INBOUND,
        raw_text=raw_text,
        normalized_text=normalized_text,
    )


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


async def test_known_intents_includes_defaults_even_when_db_has_narrower_history(db_session, conversation):
    # Regression test: a DB that only ever recorded "question" (e.g. a
    # freshly seeded one) must not narrow the model's option list down to
    # just that value — it should still see the full default set alongside
    # whatever's been observed, or the classifier gets told "question" is
    # the only valid answer and keeps reinforcing itself.
    db_session.add(
        Message(
            conversation_id=conversation.id,
            direction=Direction.INBOUND,
            normalized_text="hi",
            intent="question",
        )
    )
    await db_session.flush()
    intents = await _known_intents(db_session, conversation.merchant_id)
    assert set(DEFAULT_INTENTS).issubset(set(intents))


async def test_known_intents_adds_newly_observed_labels(db_session, conversation):
    db_session.add(
        LabeledExample(
            merchant_id=conversation.merchant_id,
            normalized_text="foo",
            intent="custom_intent_from_label",
            source="test",
        )
    )
    db_session.add(
        Message(
            conversation_id=conversation.id,
            direction=Direction.INBOUND,
            normalized_text="hi",
            intent="custom_intent_from_message",
        )
    )
    await db_session.flush()
    intents = await _known_intents(db_session, conversation.merchant_id)
    assert "custom_intent_from_label" in intents
    assert "custom_intent_from_message" in intents


async def test_known_intents_scoped_to_merchant(db_session, merchant, conversation):
    other_merchant = Merchant(name="Other Merchant")
    db_session.add(other_merchant)
    await db_session.flush()
    other_conversation = Conversation(
        merchant_id=other_merchant.id,
        customer_ref="other-cust",
        state=ConvState.NEW,
        slots={},
        last_message_at=conversation.last_message_at,
    )
    db_session.add(other_conversation)
    await db_session.flush()
    db_session.add(
        Message(
            conversation_id=other_conversation.id,
            direction=Direction.INBOUND,
            normalized_text="hi",
            intent="other_merchants_secret_intent",
        )
    )
    await db_session.flush()

    intents = await _known_intents(db_session, merchant.id)

    assert "other_merchants_secret_intent" not in intents
    assert set(DEFAULT_INTENTS) <= set(intents)


async def test_tier0_short_circuit_skips_ai_calls(db_session, conversation, mock_ai):
    result = await process_message(db_session, conversation, _inbound_message(conversation, "👍", "👍"))
    assert result.message.intent == "reaction"
    assert result.message.model_tier == ModelTier.RULE
    assert result.order is None
    assert not mock_ai.calls


async def test_purchase_intent_in_gathering_creates_order(db_session, conversation, mock_ai):
    # AUTO_CONFIRMED requires the line item to actually resolve to a real,
    # priced product now (Task 4) - a matching, priced product must be
    # seeded, unlike before this task when list-truthiness alone decided
    # status. The seeded embedding matches _embedding_response()'s fixed
    # vector exactly (distance 0) so the resolution genuinely succeeds.
    product = Product(merchant_id=conversation.merchant_id, name="رز", price=Decimal("50.00"), embedding=[0.1] * 1024)
    db_session.add(product)
    await db_session.flush()

    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        side_effect=[
            httpx.Response(200, json=_chat_response('{"intent": "purchase_intent", "confidence": 0.9}')),
            httpx.Response(
                200,
                json=_chat_response(
                    '{"line_items": [{"product_name": "رز", "quantity": 1}], "ambiguous_fields": [], "confidence": 0.9}'
                ),
            ),
        ]
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    result = await process_message(
        db_session, conversation, _inbound_message(conversation, "عايز اطلب رز", "عايز اطلب رز")
    )

    assert result.message.intent == "purchase_intent"
    assert result.message.model_tier == ModelTier.DEEPSEEK
    assert result.order is not None
    assert result.order.status == OrderStatus.AUTO_CONFIRMED


async def test_purchase_intent_line_items_match_seeded_product(db_session, conversation, mock_ai):
    close_vector = [1.0] * 1024
    product = Product(merchant_id=conversation.merchant_id, name="Summer Linen Dress", embedding=close_vector)
    db_session.add(product)
    await db_session.flush()

    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        side_effect=[
            httpx.Response(200, json=_chat_response('{"intent": "purchase_intent", "confidence": 0.9}')),
            httpx.Response(
                200,
                json=_chat_response(
                    '{"line_items": [{"product_name": "فستان صيفي", "quantity": 1.0}], '
                    '"ambiguous_fields": [], "confidence": 0.9}'
                ),
            ),
        ]
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    result = await process_message(
        db_session, conversation, _inbound_message(conversation, "عايز فستان صيفي", "عايز فستان صيفي")
    )

    assert result.order is not None
    assert result.order.extracted_payload["line_items"][0]["product_id"] == product.id


async def test_purchase_intent_creates_order_items_for_resolved_lines(db_session, conversation, mock_ai):
    # Regression guard: before Task 4, the extraction path only ever
    # constructed an Order row directly - no OrderItem rows were ever
    # created on this path, for any input.
    product = Product(merchant_id=conversation.merchant_id, name="رز", price=Decimal("50.00"), embedding=[0.1] * 1024)
    db_session.add(product)
    await db_session.flush()

    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        side_effect=[
            httpx.Response(200, json=_chat_response('{"intent": "purchase_intent", "confidence": 0.9}')),
            httpx.Response(
                200,
                json=_chat_response(
                    '{"line_items": [{"product_name": "رز", "quantity": 2}], "ambiguous_fields": [], "confidence": 0.9}'
                ),
            ),
        ]
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    result = await process_message(
        db_session, conversation, _inbound_message(conversation, "عايز اطلب رز", "عايز اطلب رز")
    )

    assert result.order is not None
    assert result.order.status == OrderStatus.AUTO_CONFIRMED
    items = (await db_session.execute(select(OrderItem).where(OrderItem.order_id == result.order.id))).scalars().all()
    assert len(items) == 1
    assert items[0].product_id == product.id
    assert items[0].unit_price == Decimal("50.00")


async def test_purchase_intent_with_unresolved_product_forces_pending_review(db_session, conversation, mock_ai):
    # No product is seeded, so the embedding search finds nothing and
    # product_id stays None. Before Task 4, status was decided purely on
    # whether extraction.line_items was non-empty - this would have wrongly
    # produced AUTO_CONFIRMED here despite high confidence and no
    # ambiguous_fields. This is the exact latent gap this task closes.
    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        side_effect=[
            httpx.Response(200, json=_chat_response('{"intent": "purchase_intent", "confidence": 0.95}')),
            httpx.Response(
                200,
                json=_chat_response(
                    '{"line_items": [{"product_name": "حاجة مش موجودة", "quantity": 1}], '
                    '"ambiguous_fields": [], "confidence": 0.95}'
                ),
            ),
        ]
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    result = await process_message(
        db_session, conversation, _inbound_message(conversation, "عايز حاجة مش موجودة", "عايز حاجة مش موجودة")
    )

    assert result.order is not None
    assert result.order.status == OrderStatus.PENDING_REVIEW


async def test_purchase_intent_product_with_variants_but_no_hint_forces_pending_review(
    db_session, conversation, mock_ai
):
    product = Product(
        merchant_id=conversation.merchant_id, name="تيشيرت", price=Decimal("100.00"), embedding=[0.1] * 1024
    )
    db_session.add(product)
    await db_session.flush()
    db_session.add(ProductVariant(product_id=product.id, label="XL", attributes={"size": "XL"}))
    await db_session.flush()

    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        side_effect=[
            httpx.Response(200, json=_chat_response('{"intent": "purchase_intent", "confidence": 0.9}')),
            httpx.Response(
                200,
                json=_chat_response(
                    '{"line_items": [{"product_name": "تيشيرت", "quantity": 1}], '
                    '"ambiguous_fields": [], "confidence": 0.9}'
                ),
            ),
        ]
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    result = await process_message(
        db_session, conversation, _inbound_message(conversation, "عايز تيشيرت", "عايز تيشيرت")
    )

    assert result.order is not None
    assert result.order.status == OrderStatus.PENDING_REVIEW


async def test_purchase_intent_with_variant_hint_resolves_variant_and_auto_confirms(db_session, conversation, mock_ai):
    product = Product(
        merchant_id=conversation.merchant_id, name="تيشيرت", price=Decimal("100.00"), embedding=[0.1] * 1024
    )
    db_session.add(product)
    await db_session.flush()
    variant = ProductVariant(product_id=product.id, label="XL", attributes={"size": "XL"})
    db_session.add(variant)
    await db_session.flush()

    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        side_effect=[
            httpx.Response(200, json=_chat_response('{"intent": "purchase_intent", "confidence": 0.9}')),
            httpx.Response(
                200,
                json=_chat_response(
                    '{"line_items": [{"product_name": "تيشيرت", "quantity": 1, "variant_hint": "XL"}], '
                    '"ambiguous_fields": [], "confidence": 0.9}'
                ),
            ),
        ]
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    result = await process_message(
        db_session, conversation, _inbound_message(conversation, "عايز تيشيرت XL", "عايز تيشيرت XL")
    )

    assert result.order is not None
    assert result.order.status == OrderStatus.AUTO_CONFIRMED
    items = (await db_session.execute(select(OrderItem).where(OrderItem.order_id == result.order.id))).scalars().all()
    assert len(items) == 1
    assert items[0].variant_id == variant.id


async def test_classification_failure_persists_message_instead_of_losing_it(db_session, conversation, mock_ai):
    # Regression: a malformed/empty response from the classifier must not raise
    # out of process_message and lose the inbound message row — it must persist
    # the message with an explicit failure marker so the request can be retried.
    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        return_value=httpx.Response(200, json=_chat_response("not json"))
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    result = await process_message(
        db_session, conversation, _inbound_message(conversation, "عايز اطلب حاجة", "عايز اطلب حاجة")
    )

    assert result.message.id is not None
    assert result.message.escalation_reason == "ai_call_failed"
    assert result.message.intent is None
    assert result.order is None


async def test_extraction_failure_persists_message_and_classification(db_session, conversation, mock_ai):
    # Same guarantee for the extraction leg: classification already succeeded
    # and must not be thrown away just because the extraction call failed.
    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        side_effect=[
            httpx.Response(200, json=_chat_response('{"intent": "purchase_intent", "confidence": 0.9}')),
            httpx.Response(200, json=_chat_response("not json")),
        ]
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    result = await process_message(
        db_session, conversation, _inbound_message(conversation, "عايز اطلب رز", "عايز اطلب رز")
    )

    assert result.message.intent == "purchase_intent"
    assert result.message.escalation_reason == "ai_call_failed"
    assert result.order is None


async def test_non_purchase_intent_does_not_create_order(db_session, conversation, mock_ai):
    # A short question ("how much?") must stay on tier 1 — regression guard for
    # the reasoning-heavy density check firing on any single "؟" (see
    # routing_policy.DENSITY_CHECK_MIN_LENGTH).
    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        return_value=httpx.Response(200, json=_chat_response('{"intent": "question", "confidence": 0.9}'))
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    result = await process_message(
        db_session, conversation, _inbound_message(conversation, "الاسعار كام؟", "الاسعار كام؟")
    )

    assert result.message.intent == "question"
    assert result.message.model_tier == ModelTier.DEEPSEEK
    assert result.order is None


async def test_process_message_persists_ai_usage_event(db_session, conversation, mock_ai):
    # NOTE: "hi" matches the tier0 greeting regex and would short-circuit before
    # any gateway call, so this uses a message that reaches the classifier
    # instead (same text as test_non_purchase_intent_does_not_create_order).
    # The mocked intent value itself is arbitrary here — only the usage event
    # persisted for the one AI call is under test.
    # The pipeline now makes two calls for a non-order message: classification,
    # then reply generation — both must be tracked.
    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        side_effect=[
            httpx.Response(200, json=_chat_response('{"intent": "greeting", "confidence": 0.95}')),
            httpx.Response(200, json=_chat_response('{"reply": "أهلاً!"}')),
        ]
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    result = await process_message(
        db_session, conversation, _inbound_message(conversation, "الاسعار كام؟", "الاسعار كام؟")
    )

    events = (
        (await db_session.execute(select(AIUsageEvent).where(AIUsageEvent.message_id == result.message.id)))
        .scalars()
        .all()
    )
    assert len(events) == 2
    assert all(e.tier == "deepseek" for e in events)
    assert all(e.conversation_id == conversation.id for e in events)
    assert all(e.latency_ms > 0 for e in events)
    assert all(e.success for e in events)


async def test_process_message_routes_to_action_resolution_when_enabled(db_session, conversation, mock_ai):
    # Set the feature flag on the merchant
    merchant = await db_session.get(Merchant, conversation.merchant_id)
    merchant.ai_tool_ordering_enabled = True
    await db_session.flush()

    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        return_value=httpx.Response(
            200, json=_chat_response('{"action": "search_store_knowledge", "query": "test", "confidence": 0.95}')
        )
    )

    result = await process_message(
        db_session, conversation, _inbound_message(conversation, "order status", "order status")
    )

    # search_store_knowledge now runs for real (Task 2) — with no StoreKnowledge
    # rows seeded for this merchant it returns zero matches, executes
    # successfully, and needs no escalation.
    assert result.message.model_tier == ModelTier.DEEPSEEK
    assert result.message.escalation_reason is None
    assert result.order is None


async def test_classification_call_sets_max_tokens(db_session, conversation, mock_ai):
    route = mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        return_value=httpx.Response(200, json=_chat_response('{"intent": "question", "confidence": 0.9}'))
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    await process_message(db_session, conversation, _inbound_message(conversation, "الاسعار كام؟", "الاسعار كام؟"))

    sent_body = json.loads(route.calls[0].request.content)
    assert sent_body["max_tokens"] == settings.AI_MAX_OUTPUT_TOKENS


async def test_question_intent_returns_seeded_knowledge_answer(db_session, conversation, mock_ai):
    db_session.add(
        StoreKnowledge(
            merchant_id=conversation.merchant_id,
            knowledge_type="shipping",
            title="سياسة الشحن",
            content="بنشحن لكل محافظات مصر خلال يومين لأربعة أيام.",
            keywords=["شحن", "توصيل"],
        )
    )
    await db_session.flush()

    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        side_effect=[
            httpx.Response(200, json=_chat_response('{"intent": "question", "confidence": 0.9}')),
            httpx.Response(200, json=_chat_response('{"reply": "بنوصل لكل المحافظات خلال يومين لأربعة يام!"}')),
        ]
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    result = await process_message(
        db_session, conversation, _inbound_message(conversation, "الشحن بيوصل امتى؟", "الشحن بيوصل امتى؟")
    )

    # The raw knowledge content is grounding input to the generation call,
    # not the reply itself — the customer gets the AI-written reply.
    assert result.messages[0].text == "بنوصل لكل المحافظات خلال يومين لأربعة يام!"


async def test_question_intent_prefers_more_specific_knowledge_match(db_session, conversation, mock_ai):
    db_session.add(
        StoreKnowledge(
            merchant_id=conversation.merchant_id,
            knowledge_type="shipping",
            title="سياسات ومواعيد الشحن",
            content="يتم شحن الطلبات خلال 24 ساعة من تأكيد الطلب. يستغرق التوصيل من 2 إلى 4 أيام عمل.",
            keywords=["مواعيد"],
        )
    )
    db_session.add(
        StoreKnowledge(
            merchant_id=conversation.merchant_id,
            knowledge_type="general",
            title="ساعات العمل وتوافر الدعم",
            content="فريق خدمة العملاء متاح للرد على استفساراتكم من السبت إلى الخميس، من الساعة 10 صباحاً وحتى 10 مساءً.",
            keywords=["مواعيد العمل"],
        )
    )
    await db_session.flush()

    route = mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        side_effect=[
            httpx.Response(200, json=_chat_response('{"intent": "question", "confidence": 0.9}')),
            httpx.Response(200, json=_chat_response('{"reply": "مواعيد العمل من ١٠ الصبح لـ ١٠ بالليل."}')),
        ]
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    result = await process_message(
        db_session, conversation, _inbound_message(conversation, "ايه هي مواعيد العمل؟", "ايه هي مواعيد العمل؟")
    )

    assert result.messages[0].text == "مواعيد العمل من ١٠ الصبح لـ ١٠ بالليل."
    # The more specific knowledge match is what gets grounded into the
    # generation prompt (call[0] is classification, call[1] is generation).
    generation_body = json.loads(route.calls[1].request.content)
    assert "فريق خدمة العملاء متاح للرد على استفساراتكم" in generation_body["messages"][1]["content"]


async def test_no_matching_knowledge_generates_reply_without_store_info(db_session, conversation, mock_ai):
    route = mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        side_effect=[
            httpx.Response(200, json=_chat_response('{"intent": "question", "confidence": 0.9}')),
            httpx.Response(200, json=_chat_response('{"reply": "هتأكد وأرد عليك حالا!"}')),
        ]
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    result = await process_message(
        db_session, conversation, _inbound_message(conversation, "الاسعار كام؟", "الاسعار كام؟")
    )

    assert result.messages[0].text == "هتأكد وأرد عليك حالا!"
    generation_body = json.loads(route.calls[1].request.content)
    assert "store_info:" not in generation_body["messages"][1]["content"]


async def test_purchase_intent_with_order_skips_knowledge_lookup(db_session, conversation, mock_ai):
    db_session.add(
        StoreKnowledge(
            merchant_id=conversation.merchant_id,
            knowledge_type="general",
            title="x",
            content="should not appear when an order was produced",
            keywords=["رز"],
        )
    )
    await db_session.flush()

    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        side_effect=[
            httpx.Response(200, json=_chat_response('{"intent": "purchase_intent", "confidence": 0.9}')),
            httpx.Response(
                200,
                json=_chat_response(
                    '{"line_items": [{"product_name": "رز", "quantity": 1}], "ambiguous_fields": [], "confidence": 0.9}'
                ),
            ),
        ]
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    result = await process_message(
        db_session, conversation, _inbound_message(conversation, "عايز اطلب رز", "عايز اطلب رز")
    )

    assert result.order is not None
    assert len(result.messages) == 1
    assert "تم استلام طلبك" in result.messages[0].text


async def test_tier0_greeting_generates_ai_reply(db_session, conversation, mock_ai):
    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        return_value=httpx.Response(200, json=_chat_response('{"reply": "أهلاً وسهلاً! إزاي أقدر أساعدك؟"}'))
    )

    result = await process_message(db_session, conversation, _inbound_message(conversation, "أهلا", "أهلا"))

    assert result.message.intent == "greeting"
    assert result.message.model_tier == ModelTier.RULE
    assert result.messages[0].text == "أهلاً وسهلاً! إزاي أقدر أساعدك؟"


async def test_tier0_greeting_generation_failure_falls_back_to_none(db_session, conversation, mock_ai):
    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        return_value=httpx.Response(200, json=_chat_response("not json"))
    )

    result = await process_message(db_session, conversation, _inbound_message(conversation, "أهلا", "أهلا"))

    # Worker falls back to just the main menu if AI generation for greeting fails.
    assert len(result.messages) == 1
    assert "تحب تعمل إيه؟" in result.messages[0].text
    events = (await db_session.execute(select(AIUsageEvent))).scalars().all()
    assert any(e.success is False for e in events)


async def test_generation_failure_on_question_path_falls_back_to_none(db_session, conversation, mock_ai):
    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        side_effect=[
            httpx.Response(200, json=_chat_response('{"intent": "question", "confidence": 0.9}')),
            httpx.Response(200, json=_chat_response("not json")),
        ]
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    result = await process_message(
        db_session, conversation, _inbound_message(conversation, "الاسعار كام؟", "الاسعار كام؟")
    )

    assert not result.messages


async def test_low_confidence_classification_escalates_without_auto_reply(db_session, conversation, mock_ai):
    # Regression guard: after a human handoff the bot must stay silent —
    # the pipeline must not fall through to knowledge search / generation.
    db_session.add(
        StoreKnowledge(
            merchant_id=conversation.merchant_id,
            knowledge_type="shipping",
            title="سياسة الشحن",
            content="بنشحن لكل محافظات مصر.",
            keywords=["شحن"],
        )
    )
    await db_session.flush()

    mock_ai.post(f"{settings.OPENROUTER_BASE_URL}/chat/completions").mock(
        return_value=httpx.Response(200, json=_chat_response('{"intent": "question", "confidence": 0.1}'))
    )
    mock_ai.post(f"{settings.EMBEDDING_BASE_URL}/embeddings").mock(
        return_value=httpx.Response(200, json=_embedding_response())
    )

    result = await process_message(
        db_session, conversation, _inbound_message(conversation, "الشحن بيوصل امتى؟", "الشحن بيوصل امتى؟")
    )

    assert result.message.escalation_reason is not None
    assert not result.messages
