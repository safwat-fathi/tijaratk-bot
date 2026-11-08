import { describe, expect, it } from 'vitest';
import { type ProductRead, extractSearchTokens } from '../domains/products/service.js';
import type { StoreKnowledgeRead } from '../domains/store-knowledge/service.js';
import { formatCatalog, formatPolicies } from './store-facts.js';

const prod = (o: Partial<ProductRead> = {}): ProductRead => ({
  id: 'p1',
  merchant_id: 'm1',
  name: 'تيشيرت قطن',
  aliases: ['tshirt'],
  variants: [],
  price: 250,
  category: null,
  description: null,
  image_url: null,
  offer_price: null,
  offer_ends_at: null,
  offer_active: false,
  ...o,
});

const pol = (id: string, title: string, content: string): StoreKnowledgeRead => ({
  id,
  merchant_id: 'm1',
  knowledge_type: 'shipping',
  title,
  content,
  keywords: [],
  created_at: '2026-01-01T00:00:00.000Z',
});

describe('store-facts pure formatters', () => {
  const now = new Date('2026-06-01T00:00:00Z');

  it('formats plain products, active vs expired offers, variants, and optional IDs', () => {
    const activeOffer = prod({
      id: 'p2',
      name: 'هودي شتوي',
      aliases: [],
      price: 500,
      offer_price: 400,
      offer_ends_at: '2026-06-10T00:00:00.000Z',
      offer_active: true,
    });
    const expiredOffer = prod({
      id: 'p3',
      name: 'جاكيت',
      aliases: [],
      price: 700,
      offer_price: 550,
      offer_ends_at: '2026-05-01T00:00:00.000Z',
      offer_active: false,
    });
    const variantPriced = prod({
      id: 'p4',
      name: 'بنطلون جينز',
      aliases: [],
      price: null,
      variants: [
        { id: 'v1', product_id: 'p4', label: 'M', sku: null, price: 300, stock: null, status: 'ACTIVE', attributes: {} },
        { id: 'v2', product_id: 'p4', label: 'L', sku: null, price: 320, stock: 0, status: 'ACTIVE', attributes: {} },
        { id: 'v3', product_id: 'p4', label: 'XL', sku: null, price: 350, stock: 5, status: 'OUT_OF_STOCK', attributes: {} },
      ],
    });

    const text = formatCatalog([prod(), activeOffer, expiredOffer, variantPriced], { now });
    expect(text).toContain('- تيشيرت قطن (tshirt): 250 جنيه');
    expect(text).not.toContain('product_id=');
    expect(text).toContain('- هودي شتوي: 400 جنيه (عرض بدلاً من 500 جنيه حتى 2026-06-10)');
    expect(text).toContain('- جاكيت: 700 جنيه');
    expect(text).not.toContain('550');
    expect(text).toContain('- بنطلون جينز: (السعر حسب المقاس/النوع)');
    expect(text).toContain('  * M: 300 جنيه (متاح)');
    expect(text).toContain('  * L: 320 جنيه (غير متاح)');
    expect(text).toContain('  * XL: 350 جنيه (غير متاح)');

    const withIds = formatCatalog([variantPriced], { now, withIds: true });
    expect(withIds).toContain('[product_id=p4]');
    expect(withIds).toContain('[variant_id=v1]');
  });

  it('orders keyword-matched policies first, then remaining oldest-first, and enforces char budget', () => {
    // listKnowledge returns newest-first: [newest, middle, oldest]
    const all = [pol('3', 'الأحدث', 'محتوى ٣'), pol('2', 'الأوسط', 'محتوى ٢'), pol('1', 'الأقدم', 'محتوى ١')];
    const { text, dropped } = formatPolicies([{ id: '2' }], all);
    expect(dropped).toBe(0);
    expect(text.split('\n')).toEqual([
      '- [shipping] الأوسط: محتوى ٢',
      '- [shipping] الأقدم: محتوى ١',
      '- [shipping] الأحدث: محتوى ٣',
    ]);

    const { text: capped, dropped: droppedCount } = formatPolicies([], all, 60);
    expect(droppedCount).toBe(1);
    expect(capped.split('\n')).toHaveLength(2);
  });

  it('extracts search tokens with leading "ال" stripped', () => {
    const tokens = extractSearchTokens('سعر التيشيرت كام في المتجر؟');
    expect(tokens).toContain('تيشيرت');
    expect(tokens).toContain('التيشيرت');
    expect(tokens).not.toContain('في');
  });
});
