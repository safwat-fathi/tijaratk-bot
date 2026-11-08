import { Logger } from '@nestjs/common';
import type { OutboundMessage } from './models.js';
import { renderFacebook } from './renderer.js';

const SEND_API_URL = 'https://graph.facebook.com/v26.0/me/messages';
const HTTP_TIMEOUT_MS = 10_000;
const log = new Logger('messaging.sender');

/** Overridable in tests. */
export const http = { fetch: (...a: Parameters<typeof fetch>) => fetch(...a) };

/**
 * Sends a sequence of rich messages. One boolean per message; failures are logged, never thrown,
 * so the caller decides how to handle partial delivery.
 */
export async function sendFacebookMessages(
  pageAccessToken: string,
  recipientId: string,
  messages: OutboundMessage[],
): Promise<boolean[]> {
  const results: boolean[] = [];
  for (const msg of messages) {
    let fbMessage: Record<string, unknown>;
    try {
      fbMessage = renderFacebook(msg);
    } catch (e) {
      log.warn(`fb_render_failed kind=${msg.kind} error=${e}`);
      results.push(false);
      continue;
    }
    results.push(await sendSingle(pageAccessToken, recipientId, fbMessage));
  }
  return results;
}

async function sendSingle(token: string, recipientId: string, fbMessage: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await http.fetch(`${SEND_API_URL}?${new URLSearchParams({ access_token: token })}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipient: { id: recipientId }, message: fbMessage, messaging_type: 'RESPONSE' }),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (res.status !== 200) {
      log.warn(`fb_send_failed status=${res.status} body=${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    log.warn(`fb_send_error error=${e}`);
    return false;
  }
}
