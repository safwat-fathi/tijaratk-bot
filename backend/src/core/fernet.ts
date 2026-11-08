import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Wire-compatible with Python's cryptography.fernet (spec: github.com/fernet/spec).
export class Fernet {
  private readonly signKey: Buffer;
  private readonly encKey: Buffer;

  constructor(key: string) {
    const raw = Buffer.from(key, 'base64url');
    if (raw.length !== 32) throw new Error('Fernet key must be 32 url-safe base64-encoded bytes');
    this.signKey = raw.subarray(0, 16);
    this.encKey = raw.subarray(16);
  }

  encrypt(plain: string, now = Date.now()): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-128-cbc', this.encKey, iv);
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const ts = Buffer.alloc(8);
    ts.writeBigUInt64BE(BigInt(Math.floor(now / 1000)));
    const head = Buffer.concat([Buffer.from([0x80]), ts, iv, body]);
    const mac = createHmac('sha256', this.signKey).update(head).digest();
    return Buffer.concat([head, mac]).toString('base64url');
  }

  /** Returns null when the token is not a valid Fernet token for this key. */
  decrypt(token: string): string | null {
    const raw = Buffer.from(token, 'base64url');
    if (raw.length < 1 + 8 + 16 + 16 + 32 || raw[0] !== 0x80) return null;
    const head = raw.subarray(0, raw.length - 32);
    const mac = raw.subarray(raw.length - 32);
    const expected = createHmac('sha256', this.signKey).update(head).digest();
    if (!timingSafeEqual(mac, expected)) return null;
    try {
      const decipher = createDecipheriv('aes-128-cbc', this.encKey, head.subarray(9, 25));
      return Buffer.concat([decipher.update(head.subarray(25)), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }
}
