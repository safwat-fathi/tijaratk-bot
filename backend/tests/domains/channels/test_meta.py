import hashlib
import hmac
import json

from app.core.config import settings
from app.domains.channels.meta import parse_meta_payload, verify_meta_signature
from app.models import Channel


def _sign(body: bytes) -> str:
    digest = hmac.new(settings.META_APP_SECRET.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def test_verify_meta_signature_accepts_valid_signature(monkeypatch):
    monkeypatch.setattr(settings, "META_APP_SECRET", "test-app-secret")
    body = b'{"object": "page"}'

    assert verify_meta_signature(body, _sign(body)) is True


def test_verify_meta_signature_rejects_wrong_signature(monkeypatch):
    monkeypatch.setattr(settings, "META_APP_SECRET", "test-app-secret")
    body = b'{"object": "page"}'

    assert verify_meta_signature(body, "sha256=" + "0" * 64) is False


def test_verify_meta_signature_rejects_when_secret_unset(monkeypatch):
    monkeypatch.setattr(settings, "META_APP_SECRET", "")
    body = b'{"object": "page"}'

    assert verify_meta_signature(body, _sign(body)) is False


def test_verify_meta_signature_rejects_missing_header(monkeypatch):
    monkeypatch.setattr(settings, "META_APP_SECRET", "test-app-secret")

    assert verify_meta_signature(b"{}", None) is False


def _messenger_payload(mid: str, text: str, *, is_echo: bool = False) -> dict:
    message: dict = {"mid": mid, "text": text}
    if is_echo:
        message["is_echo"] = True
    return {
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
                        "message": message,
                    }
                ],
            }
        ],
    }


def test_parse_meta_payload_extracts_messenger_text_message():
    payload = _messenger_payload("mid.111", "hello")

    parsed = parse_meta_payload(payload)

    assert len(parsed) == 1
    assert parsed[0].channel == Channel.FACEBOOK
    assert parsed[0].external_account_id == "test-page-id"
    assert parsed[0].external_customer_id == "customer-1"
    assert parsed[0].external_message_id == "mid.111"
    assert parsed[0].text == "hello"


def test_parse_meta_payload_maps_instagram_object_to_instagram_channel():
    payload = _messenger_payload("mid.111", "hello")
    payload["object"] = "instagram"

    parsed = parse_meta_payload(payload)

    assert parsed[0].channel == Channel.INSTAGRAM


def test_parse_meta_payload_drops_echo_messages():
    payload = _messenger_payload("mid.111", "hello", is_echo=True)

    assert parse_meta_payload(payload) == []


def test_parse_meta_payload_drops_unsupported_messages():
    payload = _messenger_payload("mid.111", "")
    del payload["entry"][0]["messaging"][0]["message"]["text"]
    payload["entry"][0]["messaging"][0]["message"]["attachments"] = [{"type": "image", "payload": {}}]

    assert parse_meta_payload(payload) == []


def test_parse_meta_payload_ignores_unknown_object_type():
    payload = _messenger_payload("mid.111", "hello")
    payload["object"] = "something_else"

    assert parse_meta_payload(payload) == []


def test_parse_meta_payload_handles_multiple_entries_and_messages_in_one_batch():
    payload = _messenger_payload("mid.111", "hello")
    payload["entry"].append(
        {
            "id": "test-page-id",
            "time": 0,
            "messaging": [
                {
                    "sender": {"id": "customer-2"},
                    "recipient": {"id": "test-page-id"},
                    "timestamp": 0,
                    "message": {"mid": "mid.222", "text": "second customer"},
                }
            ],
        }
    )

    parsed = parse_meta_payload(payload)

    assert len(parsed) == 2
    assert {p.external_message_id for p in parsed} == {"mid.111", "mid.222"}


def test_round_trip_through_json_serialization():
    # Sanity check that the fixture payloads above are what a real request
    # body would deserialize to (json.dumps/loads round trip), not just a
    # Python-dict coincidence.
    payload = json.loads(json.dumps(_messenger_payload("mid.111", "hello")))
    assert parse_meta_payload(payload)[0].text == "hello"
