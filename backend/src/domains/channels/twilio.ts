import twilio from 'twilio';
import { getSettings } from '../../config.js';
import type { ParsedInboundMessage } from './meta.js';

export function verifyTwilioSignature(
  params: Record<string, string>,
  signatureHeader: string | undefined,
  s = getSettings(),
): boolean {
  if (!s.TWILIO_AUTH_TOKEN || !signatureHeader) return false;
  return twilio.validateRequest(s.TWILIO_AUTH_TOKEN, signatureHeader, s.TWILIO_WEBHOOK_URL, params);
}

export function parseTwilioPayload(params: Record<string, string>): ParsedInboundMessage | null {
  const { Body, From, To, MessageSid } = params;
  if (!Body || !From || !To || !MessageSid) return null;
  return {
    channel: 'WHATSAPP',
    externalAccountId: To,
    externalCustomerId: From,
    externalMessageId: MessageSid,
    text: Body,
    postbackPayload: null,
  };
}
