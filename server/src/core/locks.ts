import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';

const LOCK_TTL_SECONDS = 300;
const ACQUIRE_POLL_MS = 50;

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end`;

/**
 * Redis mutex keyed `conversation:{id}:lock` (SRD §36), same key + protocol as the Python
 * worker so both exclude each other during the strangler overlap.
 */
export async function withConversationLock<T>(redis: Redis, conversationId: string, fn: () => Promise<T>): Promise<T> {
  const key = `conversation:${conversationId}:lock`;
  const token = randomUUID().replaceAll('-', '');
  while ((await redis.set(key, token, 'EX', LOCK_TTL_SECONDS, 'NX')) !== 'OK') {
    await new Promise((r) => setTimeout(r, ACQUIRE_POLL_MS));
  }
  try {
    return await fn();
  } finally {
    await redis.eval(RELEASE_SCRIPT, 1, key, token);
  }
}
