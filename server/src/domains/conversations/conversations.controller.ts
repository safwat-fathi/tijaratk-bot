import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { notFound, parse } from '../../core/http.js';
import { DB } from '../../core/tokens.js';
import { type Db, schema } from '../../db/index.js';
import { AuthGuard, CurrentMerchant, type Merchant } from '../auth/auth.guard.js';
import { textFallback, textMessage } from '../messaging/models.js';
import { recordHumanActivity } from '../handoff/service.js';
import { deliver } from '../messaging/deliver.js';
import { getConversationMessages, listConversations } from './service.js';

const Reply = z.object({ text: z.string() });

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  list(@CurrentMerchant() m: Merchant) {
    return listConversations(this.db, m.id);
  }

  @Get(':id/messages')
  async messages(@CurrentMerchant() m: Merchant, @Param('id') id: string) {
    const rows = await getConversationMessages(this.db, m.id, id);
    if (!rows) throw notFound('conversation not found');
    return rows;
  }

  @Post(':id/reply')
  @HttpCode(201)
  async reply(@CurrentMerchant() m: Merchant, @Param('id') id: string, @Body() body: unknown) {
    const payload = parse(Reply, body);
    return this.db.transaction(async (tx) => {
      const [conv] = await tx.select().from(schema.conversations).where(eq(schema.conversations.id, id));
      if (!conv || conv.merchantId !== m.id) throw notFound('conversation not found');
      await recordHumanActivity(tx, m.id, conv.id); // a human is in the conversation: pause the AI until they go idle

      const msg = textMessage(payload.text);
      const [outbound] = await tx
        .insert(schema.messages)
        .values({
          conversationId: conv.id,
          direction: 'OUTBOUND',
          rawText: textFallback(msg),
          normalizedText: textFallback(msg),
          messageType: msg.kind,
          richPayload: msg,
        })
        .returning();

      let sent = false;
      if (conv.channelConnectionId) {
        const [conn] = await tx.select().from(schema.channelConnections).where(eq(schema.channelConnections.id, conv.channelConnectionId));
        if (conn) sent = (await deliver(conn, conv.customerRef, [msg]))[0] ?? false;
      }
      return { message_id: outbound.id, sent };
    });
  }
}
