import { createHmac, timingSafeEqual } from 'node:crypto';
import { getSettings } from '../../config.js';

export type Channel = 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP';

export interface ParsedInboundMessage {
  channel: Channel;
  externalAccountId: string;
  externalCustomerId: string;
  externalMessageId: string;
  text: string;
  postbackPayload: Record<string, unknown> | null;
}

const OBJECT_TO_CHANNEL: Record<string, Channel> = { page: 'FACEBOOK', instagram: 'INSTAGRAM' };

export function verifyMetaSignature(rawBody: Buffer, signatureHeader: string | undefined, secret = getSettings().META_APP_SECRET): boolean {
  if (!secret || !signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signatureHeader.slice('sha256='.length);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Decode a JSON string from a postback/quick_reply payload; non-object JSON or garbage => null. */
function safeJsonPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const data = JSON.parse(raw);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export function parseMetaPayload(payload: any): ParsedInboundMessage[] {
  const channel = OBJECT_TO_CHANNEL[payload?.object];
  if (!channel) return [];
  const parsed: ParsedInboundMessage[] = [];

  for (const entry of payload.entry ?? []) {
    const pageId = entry.id;
    for (const event of entry.messaging ?? []) {
      const sender = event.sender;
      if (!sender?.id) continue;

      // --- Text messages (with optional quick_reply) ---
      const message = event.message;
      if (message && !message.is_echo) {
        let text: string = message.text ?? '';
        const mid = message.mid;
        if (!mid) continue;
        const qr = message.quick_reply;
        const postbackPayload = safeJsonPayload(qr?.payload);
        // Facebook copies the button title into text for quick replies; prefer the title for display/history.
        if (!text && qr) text = qr.title ?? '';
        if (!text && !postbackPayload) continue;
        parsed.push({
          channel,
          externalAccountId: pageId,
          externalCustomerId: sender.id,
          externalMessageId: mid,
          text,
          postbackPayload,
        });
        continue;
      }

      // --- Postback events (button taps) ---
      const postback = event.postback;
      if (postback) {
        const postbackPayload = safeJsonPayload(postback.payload);
        // Postbacks have no mid; use a synthetic dedup key.
        const mid = postback.mid || `pb:${sender.id}:${event.timestamp ?? ''}`;
        let text: string = postback.title ?? '';
        if (postbackPayload && '_echo' in postbackPayload) text = postbackPayload._echo as string;
        parsed.push({
          channel,
          externalAccountId: pageId,
          externalCustomerId: sender.id,
          externalMessageId: mid,
          text,
          postbackPayload,
        });
      }
    }
  }
  return parsed;
}
