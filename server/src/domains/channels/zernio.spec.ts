import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseZernioPayload, verifyZernioSignature } from './zernio.js';

const payload = {
  event: 'message.received',
  message: { platform: 'facebook', direction: 'incoming', platformMessageId: 'mid.1', text: 'hi', sender: { id: 'u1' } },
  conversation: { id: 'conv1' },
  account: { accountId: 'acc1' },
};

describe('zernio', () => {
  it('parses an inbound message', () => {
    expect(parseZernioPayload(payload)).toEqual([
      { channel: 'FACEBOOK', externalAccountId: 'acc1', externalCustomerId: 'conv1', externalMessageId: 'mid.1', text: 'hi', postbackPayload: null },
    ]);
  });
  it('ignores outgoing, test and other events', () => {
    expect(parseZernioPayload({ ...payload, message: { ...payload.message, direction: 'outgoing' } })).toEqual([]);
    expect(parseZernioPayload({ ...payload, test: true })).toEqual([]);
    expect(parseZernioPayload({ ...payload, event: 'message.sent' })).toEqual([]);
  });
  it('needs a conversation id: it is the only way to reply', () => {
    expect(parseZernioPayload({ ...payload, conversation: undefined })).toEqual([]);
  });
  it('verifies the signature, with or without prefix', () => {
    const body = Buffer.from(JSON.stringify(payload));
    const sig = createHmac('sha256', 's').update(body).digest('hex');
    expect(verifyZernioSignature(body, sig, 's')).toBe(true);
    expect(verifyZernioSignature(body, `sha256=${sig}`, 's')).toBe(true);
    expect(verifyZernioSignature(body, sig, 'x')).toBe(false);
    expect(verifyZernioSignature(body, undefined, 's')).toBe(false);
  });
});
