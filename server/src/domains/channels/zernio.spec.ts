import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseZernioPayload, parseZernioSentPayload, verifyZernioSignature } from './zernio.js';

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
  describe('message.sent', () => {
    const sent = (sentVia: string | null | undefined, over: Record<string, unknown> = {}) => ({
      event: 'message.sent',
      message: { platform: 'facebook', direction: 'outgoing', platformMessageId: 'mid.9', conversationId: 'conv1', text: 'ahlan', ...(sentVia === undefined ? {} : { sentVia }), ...over },
      account: { accountId: 'acc1' },
    });
    it('parses a person reply (Zernio inbox operator, or unattributed native-inbox send)', () => {
      const expected = { channel: 'FACEBOOK', externalAccountId: 'acc1', externalCustomerId: 'conv1', externalMessageId: 'mid.9', text: 'ahlan' };
      expect(parseZernioSentPayload(sent('human'))).toEqual({ ...expected, sentVia: 'human' });
      expect(parseZernioSentPayload(sent(null))).toEqual({ ...expected, sentVia: null });
      expect(parseZernioSentPayload(sent(undefined))).toEqual({ ...expected, sentVia: null });
    });
    it('ignores automated sends, inbound messages, other events and tests', () => {
      for (const via of ['api', 'broadcast', 'sequence', 'workflow', 'comment_automation', 'bulk-api']) expect(parseZernioSentPayload(sent(via))).toBeNull();
      expect(parseZernioSentPayload(sent('human', { direction: 'incoming' }))).toBeNull();
      expect(parseZernioSentPayload({ ...sent('human'), event: 'message.received' })).toBeNull();
      expect(parseZernioSentPayload({ ...sent('human'), test: true })).toBeNull();
      expect(parseZernioSentPayload({ ...sent('human'), account: {} })).toBeNull();
    });
    it('is not picked up as an inbound message', () => {
      expect(parseZernioPayload(sent('human'))).toEqual([]);
    });
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
