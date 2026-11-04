import { Controller, Get, Inject, Post, Query, Req, Res } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Queue } from 'bullmq';
import type { Request, Response } from 'express';
import { Logger } from '@nestjs/common';
import type { Settings } from '../../config.js';
import { ApiError } from '../../core/http.js';
import { DB, PROCESS_CHANNEL_MESSAGE, QUEUE, SETTINGS } from '../../core/tokens.js';
import { type Db, schema } from '../../db/index.js';
import { type Channel, type ParsedInboundMessage, parseMetaPayload, verifyMetaSignature } from './meta.js';
import { ingestChannelMessage } from './service.js';
import { parseTwilioPayload, verifyTwilioSignature } from './twilio.js';

const log = new Logger('channels.router');
const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

@Controller('webhooks')
export class ChannelsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(QUEUE) private readonly queue: Queue,
    @Inject(SETTINGS) private readonly s: Settings,
  ) {}

  @Get('meta')
  verifyMeta(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && token !== undefined && this.s.META_VERIFY_TOKEN && safeEqual(token, this.s.META_VERIFY_TOKEN)) {
      return res.type('text/plain').send(challenge ?? '');
    }
    throw new ApiError(403, 'verification failed');
  }

  @Post('meta')
  async receiveMeta(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.status(200);
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0); // raw parser, see http-setup.ts
    if (!verifyMetaSignature(raw, req.headers['x-hub-signature-256'] as string | undefined, this.s.META_APP_SECRET)) {
      throw new ApiError(403, 'invalid signature');
    }

    let payload: any = null;
    let processingError: string | null = null;
    let parsed: ParsedInboundMessage[] = [];
    try {
      payload = JSON.parse(raw.toString('utf8'));
      parsed = parseMetaPayload(payload);
    } catch (e) {
      // webhook boundary: log and ack, never let Meta retry-storm us
      processingError = String(e);
      log.warn(`meta_webhook_parse_failed error=${e}`);
    }

    const channel: Channel = payload && typeof payload === 'object' && payload.object === 'instagram' ? 'INSTAGRAM' : 'FACEBOOK';
    const ids = await this.db.transaction(async (tx) => {
      await tx.insert(schema.webhookEvents).values({ channel, rawPayload: payload, processingError });
      const out: string[] = [];
      for (const p of parsed) {
        const id = await ingestChannelMessage(tx, p);
        if (id) out.push(id);
      }
      return out;
    });
    await this.enqueue(ids);
    return { status: 'received' };
  }

  @Post('whatsapp/twilio')
  async receiveTwilio(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.status(200);
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries((req.body ?? {}) as Record<string, string | string[]>)) {
      params[k] = Array.isArray(v) ? v[v.length - 1] : v;
    }
    if (!verifyTwilioSignature(params, req.headers['x-twilio-signature'] as string | undefined)) {
      throw new ApiError(403, 'invalid signature');
    }

    let processingError: string | null = null;
    let parsed: ParsedInboundMessage | null = null;
    try {
      parsed = parseTwilioPayload(params);
    } catch (e) {
      processingError = String(e);
      log.warn(`twilio_webhook_parse_failed error=${e}`);
    }
    const id = await this.db.transaction(async (tx) => {
      await tx.insert(schema.webhookEvents).values({ channel: 'WHATSAPP', rawPayload: params, processingError });
      return parsed ? ingestChannelMessage(tx, parsed) : null;
    });
    if (id) await this.enqueue([id]);
    return { status: 'received' };
  }

  // Enqueued only after the DB commit, so the worker can never see a message that isn't there yet.
  // jobId = messageId makes Meta/Twilio redeliveries a no-op at the queue for ~1h (finished jobs are kept that
  // long). The worker's `intent IS NOT NULL` guard alone misses the tool-ordering and human-takeover paths.
  private async enqueue(messageIds: string[]) {
    for (const messageId of messageIds) {
      await this.queue.add(
        PROCESS_CHANNEL_MESSAGE,
        { messageId },
        { jobId: messageId, attempts: 1, removeOnComplete: { age: 3600 }, removeOnFail: { age: 3600 } },
      );
    }
  }
}
