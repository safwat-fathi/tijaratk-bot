import logging
from dataclasses import dataclass

import httpx
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

_DEBUG_TOKEN_URL = "https://graph.facebook.com/debug_token"
_ME_URL = "https://graph.facebook.com/me"
_ME_ACCOUNTS_URL = "https://graph.facebook.com/me/accounts"
_SUBSCRIBED_APPS_URL_TEMPLATE = "https://graph.facebook.com/{}/subscribed_apps"

_HTTP_TIMEOUT_SECONDS = 10.0


@dataclass(frozen=True)
class FacebookIdentity:
    facebook_user_id: str
    name: str


@dataclass(frozen=True)
class FacebookPage:
    page_id: str
    name: str
    access_token: str | None


async def verify_facebook_access_token(access_token: str) -> FacebookIdentity | None:
    """Verify a Facebook user access token against the Graph API. Returns the
    verified identity, or None if the token is invalid, expired, minted for a
    different app, or any HTTP call fails."""
    app_access_token = f"{settings.META_APP_ID}|{settings.META_APP_SECRET}"

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_SECONDS) as client:
            debug_response = await client.get(
                _DEBUG_TOKEN_URL,
                params={"input_token": access_token, "access_token": app_access_token},
            )

        if debug_response.status_code >= 500:
            raise HTTPException(status_code=502, detail="Facebook Graph API unavailable")

        debug_response.raise_for_status()
        debug_data = debug_response.json()["data"]

        if debug_data.get("is_valid") is not True or debug_data.get("app_id") != settings.META_APP_ID:
            return None

        scopes = debug_data.get("scopes", [])
        required_scopes = {"pages_manage_metadata", "pages_messaging", "pages_show_list"}
        if not required_scopes.issubset(set(scopes)):
            logger.warning("missing_scopes required=%s granted=%s", required_scopes, scopes)
            return None

        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_SECONDS) as client:
            me_response = await client.get(
                _ME_URL,
                params={"access_token": access_token, "fields": "id,name"},
            )

        if me_response.status_code >= 500:
            raise HTTPException(status_code=502, detail="Facebook Graph API unavailable")

        me_response.raise_for_status()
        me_data = me_response.json()

        return FacebookIdentity(facebook_user_id=me_data["id"], name=me_data["name"])
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401 or e.response.status_code == 403:
            return None
        logger.error("facebook_api_error status=%s body=%s", e.response.status_code, e.response.text)
        raise HTTPException(status_code=502, detail="Facebook API error")
    except httpx.RequestError as e:
        logger.error("facebook_api_request_error error=%s", str(e))
        raise HTTPException(status_code=502, detail="Facebook API connection error")
    except (KeyError, TypeError, AttributeError, ValueError) as e:
        logger.error("facebook_api_parse_error error=%s", str(e))
        return None


async def fetch_user_pages(access_token: str) -> list[FacebookPage]:
    """Fetch the Facebook Pages managed by this user. Each page comes with a
    page-scoped access token that we store to send outbound replies."""
    try:
        pages = []
        next_url = _ME_ACCOUNTS_URL
        params = {"access_token": access_token, "fields": "id,name,access_token"}

        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_SECONDS) as client:
            while next_url:
                response = await client.get(next_url, params=params)
                if response.status_code >= 500:
                    raise HTTPException(status_code=502, detail="Facebook Graph API unavailable")

                response.raise_for_status()
                data = response.json()

                for page in data.get("data", []):
                    if page.get("id"):
                        pages.append(
                            FacebookPage(
                                page_id=page["id"],
                                name=page.get("name", "Unknown Page"),
                                access_token=page.get("access_token"),
                            )
                        )
                    else:
                        logger.warning("page_missing_id data=%s", page)

                paging = data.get("paging", {})
                next_url = paging.get("next")
                params = None  # URL already contains params for next page

        logger.info("fetched_user_pages count=%d pages=%s", len(pages), [(p.page_id, p.name) for p in pages])
        return pages
    except httpx.HTTPStatusError as e:
        logger.error("facebook_pages_api_error status=%s body=%s", e.response.status_code, e.response.text)
        raise HTTPException(status_code=502, detail="Facebook API error fetching pages")
    except httpx.RequestError as e:
        logger.error("facebook_pages_request_error error=%s", str(e))
        raise HTTPException(status_code=502, detail="Facebook API connection error fetching pages")
    except (KeyError, TypeError, ValueError) as e:
        logger.error("facebook_pages_parse_error error=%s", str(e))
        raise HTTPException(status_code=500, detail="Invalid response from Facebook API")


async def subscribe_page_to_app(page: FacebookPage) -> bool:
    """Subscribe the page to this app's webhooks so Meta delivers its message
    events. Idempotent; failures are logged and swallowed — a subscription
    failure must never abort the connect flow."""
    if page.access_token is None:
        logger.warning("page_subscribe_skipped_no_token page_id=%s", page.page_id)
        return False
    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_SECONDS) as client:
            response = await client.post(
                _SUBSCRIBED_APPS_URL_TEMPLATE.format(page.page_id),
                params={"access_token": page.access_token},
                data={"subscribed_fields": "messages"},
            )
        if response.status_code >= 500:
            logger.warning("page_subscribe_failed page_id=%s status=%s", page.page_id, response.status_code)
            return False
        response.raise_for_status()
        return True
    except httpx.HTTPStatusError as e:
        logger.warning(
            "page_subscribe_failed page_id=%s status=%s body=%s",
            page.page_id,
            e.response.status_code,
            e.response.text,
        )
        return False
    except httpx.RequestError as e:
        logger.warning("page_subscribe_request_error page_id=%s error=%s", page.page_id, str(e))
        return False


async def is_page_access_token_valid(page_access_token: str) -> bool:
    """Validate a page access token against the Graph API.
    Returns True if valid, False if expired, revoked, or invalid."""
    app_access_token = f"{settings.META_APP_ID}|{settings.META_APP_SECRET}"

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_SECONDS) as client:
            response = await client.get(
                _DEBUG_TOKEN_URL,
                params={"input_token": page_access_token, "access_token": app_access_token},
            )

        if response.status_code >= 500:
            return True  # Give the benefit of the doubt on Meta downtime

        response.raise_for_status()
        data = response.json()["data"]

        if data.get("is_valid") is not True or data.get("app_id") != settings.META_APP_ID:
            return False

        return True
    except httpx.HTTPError:
        return False
    except (KeyError, TypeError, ValueError):
        return False
