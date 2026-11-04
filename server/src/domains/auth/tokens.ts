import jwt from 'jsonwebtoken';
import type { Settings } from '../../config.js';

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
