import { z } from 'zod';

/** Models sometimes answer 0-100; mirrors the pydantic `normalize_confidence` before-validator. */
const confidence = z.preprocess(
  (v) => (typeof v === 'number' && v > 1 ? Math.min(v / 100, 1) : v),
  z.number().min(0).max(1),
);

export const IntentClassification = z.object({ intent: z.string(), confidence });
export type IntentClassification = z.infer<typeof IntentClassification>;

export const GeneratedReply = z.object({ reply: z.string().min(1) });

export const ExtractedLineItem = z.object({
  product_name: z.string(),
  quantity: z.number(),
  notes: z.string().nullable().default(null),
  product_id: z.string().nullable().default(null),
  variant_hint: z.string().nullable().default(null),
  variant_id: z.string().nullable().default(null),
  variant_required: z.boolean().default(false),
});
export type ExtractedLineItem = z.infer<typeof ExtractedLineItem>;

export const ExtractionBase = z.object({
  line_items: z.array(ExtractedLineItem).default([]),
  address: z.string().nullable().default(null).describe('The shipping address explicitly mentioned in the message.'),
  phone: z.string().nullable().default(null).describe('The phone number explicitly mentioned in the message.'),
  payment_method: z
    .string()
    .nullable()
    .default(null)
    .describe(
      "The payment method explicitly mentioned in the message (e.g. 'InstaPay', 'Vodafone Cash', 'Cash on Delivery'). Watch out for slang like 'Insta', 'انستا', 'كاش', 'vf cash'.",
    ),
  ambiguous_fields: z.array(z.string()).default([]),
  confidence,
});

/** Drop ambiguity flags the model raised for fields that are in fact filled in. */
export const ExtractionResult = ExtractionBase.transform((r) => ({
  ...r,
  ambiguous_fields: r.ambiguous_fields.filter((f) => {
    if (f === 'address' && r.address) return false;
    if (f === 'phone' && r.phone) return false;
    if (f === 'payment_method' && r.payment_method) return false;
    if ((f === 'line_items' || f === 'product' || f === 'size' || f === 'color') && r.line_items.length) return false;
    return true;
  }),
}));
export type ExtractionResult = z.infer<typeof ExtractionResult>;

/** `response_format` for OpenAI-compatible providers. "strict" intentionally omitted (see Python gateway). */
export function jsonSchemaResponseFormat(schema: z.ZodType, name: string) {
  // pydantic's schema has no `$schema` key; some providers' grammar compilers are picky, so match it.
  const { $schema: _drop, ...jsonSchema } = z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>;
  return { type: 'json_schema' as const, json_schema: { name, schema: jsonSchema } };
}

const action = <T extends string, S extends z.ZodRawShape>(name: T, shape: S) =>
  z.object({ action: z.literal(name), confidence, ...shape });

export const KNOWLEDGE_TYPES = ['faq', 'shipping', 'returns', 'exchange', 'payment', 'general'] as const;

export const ProposedAction = z.discriminatedUnion('action', [
  action('search_products', {
    query: z.string().min(1),
    filters: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).default({}),
  }),
  action('get_product', { product_id: z.string() }),
  action('add_to_cart', {
    product_id: z.string(),
    variant_id: z.string().nullable().default(null),
    quantity: z.number().gt(0),
    notes: z.string().nullable().default(null),
  }),
  action('update_cart', { line_item_id: z.string(), quantity: z.number().gt(0) }),
  action('remove_from_cart', { line_item_id: z.string() }),
  action('get_checkout_state', {}),
  action('update_customer_info', {
    name: z.string().nullable().default(null),
    phone: z.string().nullable().default(null),
    address: z.string().nullable().default(null),
  }),
  action('create_order', { confirm: z.boolean().default(true) }),
  action('search_store_knowledge', {
    query: z.string().min(1),
    knowledge_type: z.enum(KNOWLEDGE_TYPES).nullable().default(null),
  }),
  action('get_delivery_info', { address: z.string().nullable().default(null) }),
]);
export type ProposedAction = z.infer<typeof ProposedAction>;
