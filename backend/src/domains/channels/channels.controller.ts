import { Controller, Get, Inject, Post, Query, Req, Res } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { Request, Response } from 'express';
import { Logger } from '@nestjs/common';
import type { Settings } from '../../config.js';
import { ApiError } from '../../core/http.js';
import { safeEqual } from '../../core/safe-equal.js';
import type { Redis } from 'ioredis';
import { DB, PROCESS_CHANNEL_MESSAGE, QUEUE, REDIS, SETTINGS } from '../../core/tokens.js';
import { type Db, schema } from '../../db/index.js';
import { type Channel, type ParsedInboundMessage, parseMetaPayload, verifyMetaSignature } from './meta.js';
import { botSentRecently } from '../messaging/bot-sent.js';
import { ingestChannelMessage, ingestHumanReply } from './service.js';
import { type ParsedOutgoingMessage, parseZernioPayload, parseZernioSentPayload, verifyZernioSignature } from './zernio.js';
import { parseTwilioPayload, verifyTwilioSignature } from './twilio.js';

const log = new Logger('channels.router');

@Controller('webhooks')
export class ChannelsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(QUEUE) private readonly queue: Queue,
    @Inject(REDIS) private readonly redis: Redis,
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

  @Post('zernio')
  async receiveZernio(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.status(200);
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const signature = req.headers['x-zernio-signature'] as string | undefined;
    if (!verifyZernioSignature(raw, signature, this.s.ZERNIO_WEBHOOK_SECRET)) {
      log.warn(`zernio_webhook_rejected signature=${signature ? 'present' : 'missing'} secret_configured=${!!this.s.ZERNIO_WEBHOOK_SECRET} body_bytes=${raw.length}`);
      throw new ApiError(403, 'invalid signature');
    }
    let payload: any = null;
    let processingError: string | null = null;
    let parsed: ParsedInboundMessage[] = [];
    let sent: ParsedOutgoingMessage | null = null;
    try {
      payload = JSON.parse(raw.toString('utf8'));
      parsed = parseZernioPayload(payload);
      sent = parseZernioSentPayload(payload);
    } catch (e) {
      processingError = String(e);
      log.warn(`zernio_webhook_parse_failed error=${e}`);
    }
    log.log(`zernio_webhook event=${payload?.event} messages=${parsed.length}${sent ? ` sent_via=${sent.sentVia ?? "unattributed"}` : ''}${processingError ? ' parse_error' : ''}`);
    // An unattributed send right after our own send is Meta's echo of the bot, not a person.
    if (sent && sent.sentVia === null && (await botSentRecently(this.redis, sent.externalCustomerId))) sent = null;
    const ids = await this.db.transaction(async (tx) => {
      await tx.insert(schema.webhookEvents).values({ channel: parsed[0]?.channel ?? sent?.channel ?? 'FACEBOOK', rawPayload: payload, processingError });
      const out: string[] = [];
      for (const p of parsed) {
        const id = await ingestChannelMessage(tx, p);
        if (id) out.push(id);
      }
      if (sent) await ingestHumanReply(tx, sent);
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
