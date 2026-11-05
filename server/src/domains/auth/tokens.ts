import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Settings } from '../../config.js';
import { safeEqual } from '../../core/safe-equal.js';

export function createAccessToken(s: Settings, merchantId: string): string {
  return jwt.sign({ sub: merchantId }, s.JWT_SECRET_KEY, {
    algorithm: s.JWT_ALGORITHM as jwt.Algorithm,
    expiresIn: s.JWT_EXPIRE_MINUTES * 60,
  });
}

/** Returns the merchant id ("sub") or null on any failure. Never throws. */
export function decodeAccessToken(s: Settings, token: string): string | null {
  try {
    const payload = jwt.verify(token, s.JWT_SECRET_KEY, { algorithms: [s.JWT_ALGORITHM as jwt.Algorithm] });
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

// A merchant's API key is derived, not stored: HMAC of the merchant id under a key derived from the JWT secret.
// Anyone holding that secret can already mint any session, so this adds no new secret to protect.
// ponytail: no per-merchant rotation (suspend the merchant to cut access); add a stored key version if that is needed.
const keyMac = (s: Settings, merchantId: string) =>
  createHmac('sha256', createHmac('sha256', s.JWT_SECRET_KEY).update('merchant-api-key').digest()).update(merchantId).digest('base64url');

export const createMerchantApiKey = (s: Settings, merchantId: string): string => `tk_${merchantId}.${keyMac(s, merchantId)}`;

/** Returns the merchant id the key was issued for, or null. Never throws. */
export function merchantIdFromApiKey(s: Settings, key: string): string | null {
  const m = /^tk_([^.]+)\.([A-Za-z0-9_-]+)$/.exec(key.trim());
  return m && safeEqual(m[2], keyMac(s, m[1])) ? m[1] : null;
}
