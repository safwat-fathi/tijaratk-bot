import { describe, expect, it } from 'vitest';
import { type ProductRead, extractSearchTokens } from '../domains/products/service.js';
import { type StoreKnowledgeRead, matchKnowledge } from '../domains/store-knowledge/service.js';
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

  it('marks the catalog as a partial list only when fewer products are shown than exist', () => {
    const partial = formatCatalog([prod()], { now, total: 45 });
    expect(partial).toContain('قائمة جزئية');
    expect(partial).toContain('1 من 45');
    expect(formatCatalog([prod()], { now, total: 1 })).not.toContain('قائمة جزئية');
    expect(formatCatalog([prod()], { now })).not.toContain('قائمة جزئية');
  });

  it('truncates a policy that is over budget instead of dropping it', () => {
    const long = pol('1', 'الإرجاع', 'ا'.repeat(3500));
    const { text, dropped } = formatPolicies([], [long], 3000);
    expect(dropped).toBe(0);
    expect(text).not.toContain('لا توجد سياسات مسجلة');
    expect(text.startsWith('- [shipping] الإرجاع: ااا')).toBe(true);
    expect(text.length).toBeLessThanOrEqual(3000);
  });

  it('only says "no policies registered" when there are no rows at all', () => {
    expect(formatPolicies([], []).text).toContain('لا توجد سياسات مسجلة');
    expect(formatPolicies([], [pol('1', 'أ', 'محتوى')]).text).not.toContain('لا توجد سياسات مسجلة');
  });

  it('matches knowledge rows by keyword, longest matching keyword first, rows without keywords never', () => {
    const rows = [
      { ...pol('1', 'الشحن', 'a'), keywords: ['شحن'] },
      { ...pol('2', 'الدفع', 'b'), keywords: ['طريقة الدفع', 'دفع'] },
      { ...pol('3', 'عام', 'c'), keywords: [] },
    ];
    expect(matchKnowledge(rows, 'طريقة الدفع والشحن ايه؟').map((r) => r.id)).toEqual(['2', '1']);
    expect(matchKnowledge(rows, 'مرحبا')).toEqual([]);
  });

  it('extracts search tokens with leading "ال" stripped', () => {
    const tokens = extractSearchTokens('سعر التيشيرت كام في المتجر؟');
    expect(tokens).toContain('تيشيرت');
    expect(tokens).toContain('التيشيرت');
    expect(tokens).not.toContain('في');
  });
});
