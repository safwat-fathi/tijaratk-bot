import { buttonMessage, genericTemplateMessage, mediaMessage, quickReplyMessage, ReceiptMessageSchema } from '../src/domains/messaging/models.js';

export function buildButtonsFixture() {
  return {
    quick: quickReplyMessage('اختار', [{ title: 'السلة', payload: { action: 'view_cart' } }]),
    buttons: buttonMessage('ابدأ', [
      { title: 'نعم', payload: { a: 1 } },
      { type: 'web_url', title: 'موقعنا', url: 'https://x.test' },
    ]),
    cards: genericTemplateMessage([
      { title: 'قميص', subtitle: 'جميل', image_url: 'https://i.test/1.png' },
      { title: 'بنطلون' },
    ]),
    media: mediaMessage('https://i.test/1.png'),
    receipt: ReceiptMessageSchema.parse({
      recipient_name: 'Ali',
      order_number: '7',
      summary: { total_cost: 120 },
      address: 'Cairo',
    }),
  };
}
