import { Logger } from '@nestjs/common';
import { getSettings } from '../../config.js';
import { ApiError } from '../../core/http.js';

const log = new Logger('auth.meta_client');
const DEBUG_TOKEN_URL = 'https://graph.facebook.com/debug_token';
const ME_URL = 'https://graph.facebook.com/me';
const ME_ACCOUNTS_URL = 'https://graph.facebook.com/me/accounts';
const subscribedAppsUrl = (pageId: string) => `https://graph.facebook.com/${pageId}/subscribed_apps`;
const TIMEOUT_MS = 10_000;

/** Overridable in tests. */
export const http = { fetch: (...a: Parameters<typeof fetch>) => fetch(...a) };

export interface FacebookIdentity {
  facebookUserId: string;
  name: string;
}
export interface FacebookPage {
  pageId: string;
  name: string;
  accessToken: string | null;
}

const get = (url: string, params?: Record<string, string>) =>
  http.fetch(params ? `${url}?${new URLSearchParams(params)}` : url, { signal: AbortSignal.timeout(TIMEOUT_MS) });

const REQUIRED_SCOPES = ['pages_manage_metadata', 'pages_messaging', 'pages_show_list'];

/** Verified identity, or null if the token is invalid/expired/for another app. Graph 5xx or network errors -> 502. */
export async function verifyFacebookAccessToken(accessToken: string): Promise<FacebookIdentity | null> {
  const s = getSettings();
  const appToken = `${s.META_APP_ID}|${s.META_APP_SECRET}`;
  try {
    const debug = await get(DEBUG_TOKEN_URL, { input_token: accessToken, access_token: appToken });
    if (debug.status >= 500) throw new ApiError(502, 'Facebook Graph API unavailable');
    if (debug.status >= 400) return handleHttpStatus(debug.status, await debug.text());
    const data = ((await debug.json()) as any).data;
    if (data.is_valid !== true || data.app_id !== s.META_APP_ID) return null;
    const scopes: string[] = data.scopes ?? [];
    if (!REQUIRED_SCOPES.every((x) => scopes.includes(x))) {
      log.warn(`missing_scopes required=${REQUIRED_SCOPES} granted=${scopes}`);
      return null;
    }
    const me = await get(ME_URL, { access_token: accessToken, fields: 'id,name' });
    if (me.status >= 500) throw new ApiError(502, 'Facebook Graph API unavailable');
    if (me.status >= 400) return handleHttpStatus(me.status, await me.text());
    const meData = (await me.json()) as any;
    return { facebookUserId: meData.id, name: meData.name };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof TypeError && /fetch|network|abort/i.test(String(e.message)) || (e as Error)?.name === 'TimeoutError') {
      log.error(`facebook_api_request_error error=${e}`);
      throw new ApiError(502, 'Facebook API connection error');
    }
    log.error(`facebook_api_parse_error error=${e}`);
    return null;
  }
}

function handleHttpStatus(status: number, body: string): null {
  if (status === 401 || status === 403) return null;
  log.error(`facebook_api_error status=${status} body=${body}`);
  throw new ApiError(502, 'Facebook API error');
}

export async function fetchUserPages(accessToken: string): Promise<FacebookPage[]> {
  const pages: FacebookPage[] = [];
  let next: string | null = ME_ACCOUNTS_URL;
  let params: Record<string, string> | undefined = { access_token: accessToken, fields: 'id,name,access_token' };
  try {
    while (next) {
      const res = await get(next, params);
      if (res.status >= 500) throw new ApiError(502, 'Facebook Graph API unavailable');
      if (res.status >= 400) {
        log.error(`facebook_pages_api_error status=${res.status} body=${await res.text()}`);
        throw new ApiError(502, 'Facebook API error fetching pages');
      }
      const data = (await res.json()) as any;
      for (const page of data.data ?? []) {
        if (page.id) pages.push({ pageId: page.id, name: page.name ?? 'Unknown Page', accessToken: page.access_token ?? null });
        else log.warn(`page_missing_id data=${JSON.stringify(page)}`);
      }
      next = data.paging?.next ?? null;
      params = undefined; // next URL already contains the params
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error)?.name === 'TimeoutError' || e instanceof TypeError) {
      log.error(`facebook_pages_request_error error=${e}`);
      throw new ApiError(502, 'Facebook API connection error fetching pages');
    }
    log.error(`facebook_pages_parse_error error=${e}`);
    throw new ApiError(500, 'Invalid response from Facebook API');
  }
  log.log(`fetched_user_pages count=${pages.length}`);
  return pages;
}

/** Idempotent; failures are logged and swallowed - a subscription failure must never abort the connect flow. */
export async function subscribePageToApp(page: FacebookPage): Promise<boolean> {
  if (page.accessToken === null) {
    log.warn(`page_subscribe_skipped_no_token page_id=${page.pageId}`);
    return false;
  }
  try {
    const res = await http.fetch(`${subscribedAppsUrl(page.pageId)}?${new URLSearchParams({ access_token: page.accessToken })}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ subscribed_fields: 'messages,messaging_postbacks,messaging_optins' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      log.warn(`page_subscribe_failed page_id=${page.pageId} status=${res.status} body=${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    log.warn(`page_subscribe_request_error page_id=${page.pageId} error=${e}`);
    return false;
  }
}

/** True if valid; false if expired/revoked/invalid. Meta 5xx gets the benefit of the doubt. */
export async function isPageAccessTokenValid(pageAccessToken: string): Promise<boolean> {
  const s = getSettings();
  try {
    const res = await get(DEBUG_TOKEN_URL, { input_token: pageAccessToken, access_token: `${s.META_APP_ID}|${s.META_APP_SECRET}` });
    if (res.status >= 500) return true;
    if (res.status >= 400) return false;
    const data = ((await res.json()) as any).data;
    return data.is_valid === true && data.app_id === s.META_APP_ID;
  } catch {
    return false;
  }
}
