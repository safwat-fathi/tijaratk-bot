import httpx
import respx

from app.core.config import settings
from app.domains.auth.meta_client import verify_facebook_access_token

_DEBUG_TOKEN_URL = "https://graph.facebook.com/debug_token"
_ME_URL = "https://graph.facebook.com/me"


@respx.mock
async def test_verify_facebook_access_token_returns_identity_on_success(monkeypatch):
    monkeypatch.setattr(settings, "META_APP_ID", "test-app-id")
    monkeypatch.setattr(settings, "META_APP_SECRET", "test-app-secret")

    debug_route = respx.get(_DEBUG_TOKEN_URL).mock(
        return_value=httpx.Response(200, json={
            "data": {
                "is_valid": True,
                "app_id": "test-app-id",
                "scopes": ["pages_show_list", "pages_manage_metadata", "pages_messaging"]
            }
        })
    )
    me_route = respx.get(_ME_URL).mock(return_value=httpx.Response(200, json={"id": "fb-user-1", "name": "Amr"}))

    identity = await verify_facebook_access_token("user-access-token")

    assert identity is not None
    assert identity.facebook_user_id == "fb-user-1"
    assert identity.name == "Amr"

    assert debug_route.called
    debug_request = debug_route.calls.last.request
    debug_params = dict(httpx.QueryParams(debug_request.url.query))
    assert debug_params["input_token"] == "user-access-token"
    assert debug_params["access_token"] == "test-app-id|test-app-secret"

    assert me_route.called
    me_request = me_route.calls.last.request
    me_params = dict(httpx.QueryParams(me_request.url.query))
    assert me_params["access_token"] == "user-access-token"
    assert me_params["fields"] == "id,name"


@respx.mock
async def test_verify_facebook_access_token_returns_none_when_invalid(monkeypatch):
    monkeypatch.setattr(settings, "META_APP_ID", "test-app-id")
    monkeypatch.setattr(settings, "META_APP_SECRET", "test-app-secret")

    respx.get(_DEBUG_TOKEN_URL).mock(
        return_value=httpx.Response(200, json={"data": {"is_valid": False, "app_id": "test-app-id"}})
    )
    me_route = respx.get(_ME_URL).mock(return_value=httpx.Response(200, json={"id": "fb-user-1", "name": "Amr"}))

    identity = await verify_facebook_access_token("user-access-token")

    assert identity is None
    assert not me_route.called


@respx.mock
async def test_verify_facebook_access_token_returns_none_when_app_id_mismatch(monkeypatch):
    monkeypatch.setattr(settings, "META_APP_ID", "test-app-id")
    monkeypatch.setattr(settings, "META_APP_SECRET", "test-app-secret")

    # A genuine, unexpired Facebook token — but minted for a different app.
    respx.get(_DEBUG_TOKEN_URL).mock(
        return_value=httpx.Response(200, json={"data": {"is_valid": True, "app_id": "some-other-app-id"}})
    )
    me_route = respx.get(_ME_URL).mock(return_value=httpx.Response(200, json={"id": "fb-user-1", "name": "Amr"}))

    identity = await verify_facebook_access_token("user-access-token")

    assert identity is None
    assert not me_route.called


async def test_verify_facebook_access_token_raises_502_on_http_error(monkeypatch):
    monkeypatch.setattr(settings, "META_APP_ID", "test-app-id")
    monkeypatch.setattr(settings, "META_APP_SECRET", "test-app-secret")

    respx.get(_DEBUG_TOKEN_URL).mock(return_value=httpx.Response(500))

    import pytest
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await verify_facebook_access_token("user-access-token")

    assert exc_info.value.status_code == 502
