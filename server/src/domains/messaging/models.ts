/** Channel-neutral outbound message types (zod port of backend/app/domains/messaging/models.py). */
import { z } from 'zod';
import { pyFloat } from '../../core/pystr.js';

const payload = z.record(z.string(), z.unknown());

export const QuickReply = z.object({ title: z.string().max(20), payload: payload.default({}) });
export const Button = z.object({
  type: z.enum(['postback', 'web_url']).default('postback'),
  title: z.string().max(20),
  payload: payload.nullable().default(null),
  url: z.string().nullable().default(null),
});
export const GenericElement = z.object({
  title: z.string().max(80),
  subtitle: z.string().max(80).nullable().default(null),
  image_url: z.string().nullable().default(null),
  buttons: z.array(Button).max(3).default([]),
});
export const ReceiptItem = z.object({
  title: z.string(),
  subtitle: z.string().nullable().default(null),
  quantity: z.number().default(1),
  price: z.number().default(0),
  image_url: z.string().nullable().default(null),
});
export const ReceiptSummary = z.object({
  subtotal: z.number().nullable().default(null),
  shipping_cost: z.number().nullable().default(null),
  total_cost: z.number(),
});

export const TextMessageSchema = z.object({ kind: z.literal('text').default('text'), text: z.string() });
export const QuickReplyMessageSchema = z.object({
  kind: z.literal('quick_reply').default('quick_reply'),
  text: z.string(),
  quick_replies: z.array(QuickReply).max(13),
});
export const ButtonMessageSchema = z.object({
  kind: z.literal('button').default('button'),
  text: z.string(),
  buttons: z.array(Button).max(3),
});
export const GenericTemplateMessageSchema = z.object({
  kind: z.literal('generic_template').default('generic_template'),
  elements: z.array(GenericElement).max(10),
});
export const MediaMessageSchema = z.object({
  kind: z.literal('media').default('media'),
  media_type: z.enum(['image', 'video']).default('image'),
  url: z.string(),
});
export const ReceiptMessageSchema = z.object({
  kind: z.literal('receipt').default('receipt'),
  recipient_name: z.string(),
  order_number: z.string(),
  currency: z.string().default('EGP'),
  payment_method: z.string().default('الدفع عند الاستلام'),
  items: z.array(ReceiptItem).default([]),
  summary: ReceiptSummary,
  address: z.string().nullable().default(null),
});

export const OutboundMessageSchema = z.discriminatedUnion('kind', [
  TextMessageSchema,
  QuickReplyMessageSchema,
  ButtonMessageSchema,
  GenericTemplateMessageSchema,
  MediaMessageSchema,
  ReceiptMessageSchema,
]);

export type OutboundMessage = z.output<typeof OutboundMessageSchema>;
export type TextMessage = z.output<typeof TextMessageSchema>;
export type QuickReplyT = z.output<typeof QuickReply>;

// Constructors validate (like pydantic) and fill defaults, so `model_dump` equivalents match the Python JSON.
export const textMessage = (text: string) => TextMessageSchema.parse({ text });
export const quickReplyMessage = (text: string, quick_replies: z.input<typeof QuickReply>[]) =>
  QuickReplyMessageSchema.parse({ text, quick_replies });
export const buttonMessage = (text: string, buttons: z.input<typeof Button>[]) =>
  ButtonMessageSchema.parse({ text, buttons });
export const genericTemplateMessage = (elements: z.input<typeof GenericElement>[]) =>
  GenericTemplateMessageSchema.parse({ elements });
export const mediaMessage = (url: string, media_type: 'image' | 'video' = 'image') =>
  MediaMessageSchema.parse({ url, media_type });

/** Human-readable fallback for persistence / dashboard display. */
export function textFallback(m: OutboundMessage): string {
  switch (m.kind) {
    case 'text':
      return m.text;
    case 'quick_reply':
      return `${m.text}\n[${m.quick_replies.map((q) => q.title).join(' | ')}]`;
    case 'button':
      return `${m.text}\n[${m.buttons.map((b) => b.title).join(' | ')}]`;
    case 'generic_template':
      return `[${m.elements.length} cards: ${m.elements.map((e) => e.title).join(', ')}]`;
    case 'media':
      return `[${m.media_type}: ${m.url}]`;
    case 'receipt':
      return `إيصال الطلب #${m.order_number} — ${pyFloat(m.summary.total_cost)} ${m.currency}`;
  }
}

/** Compact JSON for a postback payload (Facebook's 1000-char limit). Matches json.dumps(separators=(",",":"), ensure_ascii=False). */
export const serializePayload = (p: Record<string, unknown>): string => JSON.stringify(p);
