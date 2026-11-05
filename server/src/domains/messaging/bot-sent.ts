import type { Redis } from 'ioredis';

const TTL_SECONDS = 30;
const key = (customerRef: string) => `bot_sent:${customerRef}`;

/**
 * Marks "the bot just sent to this customer". Zernio can report Meta's echo of our own send before it has attributed
 * it (`sentVia: null`), which would look like a human replying; the webhook ignores unattributed sends while this is set.
 */
export async function markBotSent(redis: Redis, customerRef: string): Promise<void> {
  await redis.set(key(customerRef), '1', 'EX', TTL_SECONDS);
}

export async function botSentRecently(redis: Redis, customerRef: string): Promise<boolean> {
  return (await redis.exists(key(customerRef))) === 1;
}
