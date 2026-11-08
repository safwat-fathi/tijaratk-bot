import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Channel, ParsedInboundMessage } from './meta.js';

const PLATFORM_TO_CHANNEL: Record<string, Channel> = { facebook: 'FACEBOOK', instagram: 'INSTAGRAM', whatsapp: 'WHATSAPP' };

/** HMAC-SHA256 hex of the raw body, keyed with the webhook secret. Accepts an optional `sha256=` prefix. */
export function verifyZernioSignature(rawBody: Buffer, header: string | undefined, secret: string): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'));
  const provided = Buffer.from(header.replace(/^sha256=/, ''));
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

/** `message.received` -> one inbound message; anything else (outgoing, other events, other platforms) -> []. */
export function parseZernioPayload(payload: any): ParsedInboundMessage[] {
  if (payload?.event !== 'message.received' || payload.test) return [];
  const m = payload.message;
  const channel = PLATFORM_TO_CHANNEL[m?.platform];
  const accountId = payload.account?.accountId ?? payload.account?.id;
  const conversationId = payload.conversation?.id;
  if (!channel || m.direction !== 'incoming' || !accountId || !conversationId || !m.platformMessageId) return [];
  const postback = m.metadata?.postbackPayload ?? payload.metadata?.postbackPayload;
  let postbackPayload: Record<string, unknown> | null = null;
  try {
    const p = typeof postback === 'string' ? JSON.parse(postback) : null;
    if (p && typeof p === 'object' && !Array.isArray(p)) postbackPayload = p;
  } catch {}
  const text: string = m.text ?? '';
  if (!text && !postbackPayload) return [];
  return [{
    channel,
    externalAccountId: accountId,
    externalCustomerId: conversationId, // Zernio's conversation id is also the reply handle (see messaging/deliver.ts)
    externalMessageId: m.platformMessageId,
    text,
    postbackPayload,
  }];
}

export type ParsedOutgoingMessage = {
  channel: Channel;
  externalAccountId: string;
  externalCustomerId: string;
  externalMessageId: string;
  text: string;
  /** Zernio's attribution: `human` = Zernio inbox operator, `null` = unknown (native FB/IG inbox, Meta auto-replies, or an echo of our own send). */
  sentVia: string | null;
};

/** Sends Zernio attributes to automation. Anything else (`human`, unknown) may be a person replying. */
const AUTOMATED_SENT_VIA = new Set(['api', 'broadcast', 'sequence', 'workflow', 'comment_automation', 'bulk-api']);

/** `message.sent` -> a message a person (or an unattributed sender) sent from our side; automated sends and other events -> null. */
export function parseZernioSentPayload(payload: any): ParsedOutgoingMessage | null {
  if (payload?.event !== 'message.sent' || payload.test) return null;
  const m = payload.message;
  const channel = PLATFORM_TO_CHANNEL[m?.platform];
  const accountId = payload.account?.accountId ?? payload.account?.id;
  const conversationId = m?.conversationId ?? payload.conversation?.id;
  if (!channel || m.direction !== 'outgoing' || !accountId || !conversationId || !m.platformMessageId) return null;
  const sentVia: string | null = typeof m.sentVia === 'string' ? m.sentVia : null;
  if (sentVia && AUTOMATED_SENT_VIA.has(sentVia)) return null;
  return {
    channel,
    externalAccountId: accountId,
    externalCustomerId: conversationId,
    externalMessageId: m.platformMessageId,
    text: m.text ?? '',
    sentVia,
  };
}
