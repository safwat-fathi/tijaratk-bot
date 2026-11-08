import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { RateLimitMiddleware } from './core/rate-limit.middleware.js';
import { CoreModule } from './core/core.module.js';
import { AuthController } from './domains/auth/auth.controller.js';
import { AuthGuard } from './domains/auth/auth.guard.js';
import { ChannelsController } from './domains/channels/channels.controller.js';
import { ZernioConnectController } from './domains/channels/zernio-connect.controller.js';
import { CheckoutController } from './domains/checkout/checkout.controller.js';
import { ConversationsController } from './domains/conversations/conversations.controller.js';
import { DeliveryController } from './domains/delivery/delivery.controller.js';
import { HandoffController } from './domains/handoff/handoff.controller.js';
import { HealthController, RootController } from './domains/health/health.controller.js';
import { LabeledExamplesController } from './domains/labeled-examples/labeled-examples.controller.js';
import { MerchantsController } from './domains/merchants/merchants.controller.js';
import { MessagesController } from './domains/messages/messages.controller.js';
import { PagesController } from './domains/pages/pages.controller.js';
import { ProductImagesController, ProductsController } from './domains/products/products.controller.js';
import { StoreKnowledgeController } from './domains/store-knowledge/store-knowledge.controller.js';

@Module({
  imports: [CoreModule],
  controllers: [
    RootController,
    HealthController,
    AuthController,
    ProductsController,
    ProductImagesController,
    StoreKnowledgeController,
    DeliveryController,
    LabeledExamplesController,
    MerchantsController,
    PagesController,
    ConversationsController,
    HandoffController, // shares the /conversations prefix; routes don't overlap
    MessagesController,
    CheckoutController,
    ChannelsController,
    ZernioConnectController,
  ],
  providers: [AuthGuard],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware).forRoutes('*');
  }
}
