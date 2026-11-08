/** Facebook Messenger Send API renderer: OutboundMessage -> `message` dict. */
import { type OutboundMessage, serializePayload } from './models.js';

type Btn = Extract<OutboundMessage, { kind: 'button' }>['buttons'][number];

function renderButton(b: Btn) {
  if (b.type === 'web_url') return { type: 'web_url', title: b.title, url: b.url ?? '' };
  return { type: 'postback', title: b.title, payload: serializePayload(b.payload ?? {}) };
}

export function renderFacebook(msg: OutboundMessage): Record<string, unknown> {
  switch (msg.kind) {
    case 'text':
      return { text: msg.text };
    case 'quick_reply':
      return {
        text: msg.text,
        quick_replies: msg.quick_replies.map((qr) => ({
          content_type: 'text',
          title: qr.title,
          payload: serializePayload(qr.payload),
        })),
      };
    case 'button':
      return {
        attachment: {
          type: 'template',
          payload: { template_type: 'button', text: msg.text, buttons: msg.buttons.map(renderButton) },
        },
      };
    case 'generic_template':
      return {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: msg.elements.map((el) => {
              const e: Record<string, unknown> = { title: el.title };
              if (el.subtitle) e.subtitle = el.subtitle;
              if (el.image_url) e.image_url = el.image_url;
              if (el.buttons.length) e.buttons = el.buttons.map(renderButton);
              return e;
            }),
          },
        },
      };
    case 'media':
      return { attachment: { type: msg.media_type, payload: { url: msg.url, is_reusable: true } } };
    case 'receipt': {
      const elements = msg.items.map((item) => {
        const el: Record<string, unknown> = {
          title: item.title,
          quantity: item.quantity,
          price: item.price,
          currency: msg.currency,
        };
        if (item.subtitle) el.subtitle = item.subtitle;
        if (item.image_url) el.image_url = item.image_url;
        return el;
      });
      const summary: Record<string, unknown> = { total_cost: msg.summary.total_cost };
      if (msg.summary.subtotal !== null) summary.subtotal = msg.summary.subtotal;
      if (msg.summary.shipping_cost !== null) summary.shipping_cost = msg.summary.shipping_cost;
      const payload: Record<string, unknown> = {
        template_type: 'receipt',
        recipient_name: msg.recipient_name,
        order_number: msg.order_number,
        currency: msg.currency,
        payment_method: msg.payment_method,
        elements,
        summary,
      };
      if (msg.address) {
        payload.address = { street_1: msg.address, city: '', postal_code: '', state: '', country: 'EG' };
      }
      return { attachment: { type: 'template', payload } };
    }
    default:
      throw new Error(`unsupported message kind: ${(msg as { kind: string }).kind}`);
  }
}
