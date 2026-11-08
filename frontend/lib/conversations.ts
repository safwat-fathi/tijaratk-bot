export interface Conversation {
  id: string;
  merchant_id: string;
  customer_ref: string;
  state: string;
  slots: Record<string, unknown>;
  last_message_at: string;
}


