import { schema } from './index.js';

export type Merchant = typeof schema.merchants.$inferSelect;
export type Conversation = typeof schema.conversations.$inferSelect;
export type Message = typeof schema.messages.$inferSelect;
export type NewMessage = typeof schema.messages.$inferInsert;
export type Product = typeof schema.products.$inferSelect;
export type ProductVariant = typeof schema.productVariants.$inferSelect;
export type Order = typeof schema.orders.$inferSelect;
export type OrderItem = typeof schema.orderItems.$inferSelect;
export type Cart = typeof schema.carts.$inferSelect;
export type CartItem = typeof schema.cartItems.$inferSelect;
export type ChannelConnection = typeof schema.channelConnections.$inferSelect;
export type LabeledExample = typeof schema.labeledExamples.$inferSelect;
export type StoreKnowledge = typeof schema.storeKnowledge.$inferSelect;
export type DeliveryArea = typeof schema.deliveryAreas.$inferSelect;

export type ConvState = Conversation['state'];
export type OrderStatus = Order['status'];
export type HandoffReason = (typeof schema.humanHandoffs.$inferSelect)['reason'];
