import { Logger } from '@nestjs/common';
import { getSettings } from '../../config.js';
import { type OutboundMessage, serializePayload, textFallback } from './models.js';
import { sendFacebookMessages } from './sender.js';

const API = 'https://zernio.com/api/v1';
const HTTP_TIMEOUT_MS = 10_000;
const log = new Logger('messaging.deliver');

type Conn = { channel: string; externalAccountId: string; pageAccessToken: string | null };

/**
 * Zernio request body for one message. Quick replies and media map directly; the rest degrades to text
 * (ponytail: generic_template cards become a text list until Zernio's `template` shape is verified).
 */
export function zernioBody(accountId: string, msg: OutboundMessage): Record<string, unknown> {
  switch (msg.kind) {
    case 'quick_reply':
      return { accountId, message: msg.text, quickReplies: msg.quick_replies.map((q) => ({ title: q.title, payload: serializePayload(q.payload) })) };
    case 'button': {
      // Zernio forbids buttons together with quick replies, so postback buttons become quick replies.
      const links = msg.buttons.filter((b) => b.type === 'web_url').map((b) => `${b.title}: ${b.url}`);
      const quickReplies = msg.buttons.filter((b) => b.type !== 'web_url').map((b) => ({ title: b.title, payload: serializePayload(b.payload ?? {}) }));
      return { accountId, message: [msg.text, ...links].join('\n'), ...(quickReplies.length ? { quickReplies } : {}) };
    }
    case 'generic_template':
      return { accountId, message: msg.elements.map((e) => [e.title, e.subtitle].filter(Boolean).join(' — ')).join('\n') };
    case 'media':
      return { accountId, attachmentUrl: msg.url, attachmentType: msg.media_type };
    default:
      return { accountId, message: textFallback(msg) };
  }
}

/** One boolean per message; failures are logged, never thrown (same contract as sendFacebookMessages). */
export async function sendZernioMessages(accountId: string, conversationId: string, messages: OutboundMessage[]): Promise<boolean[]> {
  const results: boolean[] = [];
  for (const msg of messages) {
    try {
      const res = await fetch(`${API}/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: 'POST',
        headers: { authorization: `Bearer ${getSettings().ZERNIO_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify(zernioBody(accountId, msg)),
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      if (!res.ok) log.warn(`zernio_send_failed status=${res.status} body=${(await res.text()).slice(0, 200)}`);
      results.push(res.ok);
    } catch (e) {
      log.warn(`zernio_send_error error=${e}`);
      results.push(false);
    }
  }
  return results;
}

/**
 * The one way to send to a customer. Connections made through the connect flow carry no page token and go via Zernio
 * (`customerRef` is Zernio's conversation id); legacy Meta-app connections keep their Graph path.
 */
export async function deliver(conn: Conn, customerRef: string, messages: OutboundMessage[]): Promise<boolean[]> {
  if (conn.pageAccessToken && conn.channel === 'FACEBOOK') return sendFacebookMessages(conn.pageAccessToken, customerRef, messages);
  if (conn.channel === 'FACEBOOK' || conn.channel === 'INSTAGRAM') return sendZernioMessages(conn.externalAccountId, customerRef, messages);
  log.warn(`no_outbound_path channel=${conn.channel}`);
  return messages.map(() => false);
}
