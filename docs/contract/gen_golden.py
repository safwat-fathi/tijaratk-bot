"""Generates docs/contract/golden.json: deterministic input/output vectors from the
Python backend, used as the spec for the NestJS port. Throwaway keys only, no real secrets.

Run: cd backend && PYTHONPATH=. uv run python ../docs/contract/gen_golden.py
"""

import hashlib
import hmac
import json
import random
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import jwt
from cryptography.fernet import Fernet
from pydantic import ValidationError
from twilio.request_validator import RequestValidator

import numpy as np
from sklearn.cluster import AgglomerativeClustering

from app.engine.classification import _intent_response_schema
from app.engine.context_budget import build_context_prompt
from app.engine.cost import estimate_cost
from app.engine.routing_policy import (
    check_reasoning_heavy,
    evaluate_postflight,
    evaluate_preflight,
)
from app.engine.schemas import ExtractionResult, GeneratedReply, IntentClassification, ProposedActionEnvelope
from app.engine.tier0_rules import match_tier0
from app.models.enums import Direction

OUT = Path(__file__).parent / "golden.json"

TIER0_INPUTS = [
    "", "   ", "hi", "Hello!", "HEY.", "السلام عليكم", "اهلا،", "أهلا؟", "صباح الخير", "مساء الخير!!",
    "hi there", "👍", "😂😂", "🔥🔥🔥", "🔥🔥🔥🔥", "☀", "❤️", "✌",
    "https://spam.example/x", "www.spam.example", "check this http://a.b/c now",
    "هل الفستان ده متاح؟ https://shop.example/dress", "هل متاح? https://a.b",
    "اشتري دلوقتي من هنا وهتكسب فلوس كتير جدا https://a.b/c/d",
    "بكام ده؟", "عايز اطلب قميص",
]

PREFLIGHT = [
    ("بكام ده؟", 0), ("بكام ده؟", 2), ("x" * 301, 0), ("x" * 300, 0),
    ("؟" * 5 + "ا" * 55, 0), ("؟" + "ا" * 58, 0), ("لو المقاس كبير يبقى هاخد الاصغر", 0),
    ("لو كده", 0), ("اذا كان متاح هيبقى تمام", 1), ("hello", 5),
]

POSTFLIGHT = [
    (0.9, 0.7, None), (0.7, 0.7, None), (0.69, 0.7, None), (0.9, 0.7, ["address"]),
    (0.5, 0.7, ["phone"]), (0.9, 0.7, []),
]


def msg(direction, normalized, raw=None):
    return SimpleNamespace(direction=direction, normalized_text=normalized, raw_text=raw)


EX = SimpleNamespace(
    normalized_text="عايز تيشيرت", intent="purchase_intent", extraction={"a": "ع"}, action={"action": "get_checkout_state"}
)
HISTORY = [
    msg(Direction.INBOUND, "اهلا"), msg(Direction.OUTBOUND, "اهلا بيك"),
    msg(Direction.INBOUND, None, "raw only"), msg(Direction.OUTBOUND, None, None),
    msg(Direction.INBOUND, "عايز قميص"),
]


def ctx_cases():
    out = []
    for mode in ("intent", "extraction", "action"):
        for examples in (None, [EX]):
            for max_turns in (2, 10):
                args = dict(history=HISTORY, slots={"name": "أحمد", "n": 1}, current_text="بكام؟", max_turns=max_turns,
                            examples=examples, mode=mode)
                out.append({
                    "mode": mode, "max_turns": max_turns, "with_examples": examples is not None,
                    "output": build_context_prompt(**args),
                })
    return out


def validate(model, data):
    try:
        v = model.model_validate(data)
        return {"input": data, "output": v.model_dump(mode="json")}
    except ValidationError:
        return {"input": data, "error": True}


def clustering_cases():
    out = []
    for seed in (1, 2, 3):
        rnd = random.Random(seed)
        centers = [[rnd.uniform(-1, 1) for _ in range(8)] for _ in range(4)]
        vectors = []
        for _ in range(40):
            c = rnd.choice(centers)
            vectors.append([x + rnd.gauss(0, 0.15) for x in c])
        for threshold in (0.1, 0.3, 0.6):
            labels = AgglomerativeClustering(
                n_clusters=None, distance_threshold=threshold, metric="cosine", linkage="average"
            ).fit_predict(np.array(vectors))
            groups: dict[int, list[int]] = {}
            for i, label in enumerate(labels):
                groups.setdefault(int(label), []).append(i)
            out.append({"vectors": vectors, "threshold": threshold, "partition": sorted(groups.values())})
    return out


def money_cases():
    cases = [
        [("12.50", 2.0)], [("0.05", 0.5)], [("0.05", 0.5), ("0.05", 0.5)], [("99.99", 1.5)], [("10.00", 0.333)],
        [("19.99", 3.0), ("5.25", 2.0), ("0.01", 0.5)], [],
    ]
    out = []
    for lines in cases:
        total = sum((Decimal(p) * Decimal(str(q)) for p, q in lines), Decimal("0.00")).quantize(Decimal("0.01"))
        each = [str((Decimal(p) * Decimal(str(q))).quantize(Decimal("0.01"))) for p, q in lines]
        out.append({"lines": lines, "subtotal": str(total), "each": each})
    return out


def main():
    fernet_key = Fernet.generate_key().decode()
    plain_token = "EAAB-page-token-ع"
    jwt_secret = "test-secret-not-real-0123456789abcdef"
    jwt_token = jwt.encode({"sub": "merchant-123", "exp": 4102444800}, jwt_secret, algorithm="HS256")
    expired = jwt.encode({"sub": "merchant-123", "exp": 1000000000}, jwt_secret, algorithm="HS256")
    meta_secret, body = "meta-app-secret-not-real", '{"object":"page","entry":[{"id":"1","ع":"x"}]}'.encode()
    tw_token, tw_url = "twilio-token-not-real", "https://example.test/webhooks/whatsapp/twilio"
    tw_params = {"Body": "مرحبا", "From": "whatsapp:+201000000000", "MessageSid": "SM1", "To": "whatsapp:+14155238886"}

    golden = {
        "tier0": [{"input": t, "output": match_tier0(t)} for t in TIER0_INPUTS],
        "reasoning_heavy": [{"input": t, "output": check_reasoning_heavy(t)} for t, _ in PREFLIGHT],
        "preflight": [{"text": t, "correction_count": c, "output": evaluate_preflight(text=t, correction_count=c)} for t, c in PREFLIGHT],
        "postflight": [
            {"confidence": c, "threshold": th, "ambiguous_fields": a,
             "output": evaluate_postflight(confidence=c, threshold=th, ambiguous_fields=a)}
            for c, th, a in POSTFLIGHT
        ],
        "cost": [{"model": "any", "in": 100, "out": 50, "output": estimate_cost("any", 100, 50)},
                 {"model": "any", "in": None, "out": 5, "output": estimate_cost("any", None, 5)}],
        "context_prompt": {
            "history": [{"direction": m.direction.value, "normalized_text": m.normalized_text, "raw_text": m.raw_text} for m in HISTORY],
            "slots": {"name": "أحمد", "n": 1}, "current_text": "بكام؟",
            "example": {"normalized_text": EX.normalized_text, "intent": EX.intent, "extraction": EX.extraction, "action": EX.action},
            "cases": ctx_cases(),
        },
        "schemas": {
            "intent": [validate(IntentClassification, d) for d in (
                {"intent": "greeting", "confidence": 0.9}, {"intent": "x", "confidence": 85}, {"intent": "x", "confidence": 250},
                {"intent": "x", "confidence": -0.1}, {"confidence": 0.5})],
            "extraction": [validate(ExtractionResult, d) for d in (
                {"confidence": 0.8},
                {"confidence": 80, "address": "cairo", "phone": "010", "ambiguous_fields": ["address", "phone", "payment_method", "zip"]},
                {"confidence": 0.5, "ambiguous_fields": ["address", "size", "color", "line_items"],
                 "line_items": [{"product_name": "قميص", "quantity": 2}]},
                {"confidence": 0.5, "ambiguous_fields": ["size"]},
                {"confidence": 0.5, "line_items": [{"product_name": "x"}]})],
            "action": [validate(ProposedActionEnvelope, d) for d in (
                {"action": "get_checkout_state", "confidence": 90}, {"action": "add_to_cart", "confidence": 0.9, "product_id": "p", "quantity": 0},
                {"action": "add_to_cart", "confidence": 0.9, "product_id": "p", "quantity": 1.5},
                {"action": "search_products", "confidence": 0.9, "query": ""}, {"action": "nope", "confidence": 0.9},
                {"action": "search_store_knowledge", "confidence": 0.9, "query": "q", "knowledge_type": "bad"},
                {"action": "create_order", "confidence": 1})],
        },
        # What pydantic sends upstream as response_format.json_schema.schema - the TS port must describe the same shapes
        "json_schemas": {
            "intent": _intent_response_schema(["greeting", "other", "purchase_intent"]).model_json_schema(),
            "extraction": ExtractionResult.model_json_schema(),
            "reply": GeneratedReply.model_json_schema(),
            "action": ProposedActionEnvelope.model_json_schema(),
        },
        "clustering": clustering_cases(),
        "money": money_cases(),
        "crypto": {
            "fernet_key": fernet_key, "plaintext": plain_token,
            "fernet_token": Fernet(fernet_key.encode()).encrypt(plain_token.encode()).decode(),
            "legacy_plaintext_passthrough": "not-a-fernet-token",
            "jwt_secret": jwt_secret, "jwt_valid_sub_merchant-123": jwt_token, "jwt_expired": expired,
            "jwt_bad_sig": jwt.encode({"sub": "m", "exp": 4102444800}, "other-secret-0123456789abcdef0123", algorithm="HS256"),
            "meta_secret": meta_secret, "meta_body": body.decode(),
            "meta_signature": "sha256=" + hmac.new(meta_secret.encode(), body, hashlib.sha256).hexdigest(),
            "twilio_token": tw_token, "twilio_url": tw_url, "twilio_params": tw_params,
            "twilio_signature": RequestValidator(tw_token).compute_signature(tw_url, tw_params),
        },
    }
    OUT.write_text(json.dumps(golden, indent=2, ensure_ascii=False) + "\n")
    print("wrote", OUT, {k: len(v) if hasattr(v, "__len__") else 1 for k, v in golden.items()})


if __name__ == "__main__":
    main()
