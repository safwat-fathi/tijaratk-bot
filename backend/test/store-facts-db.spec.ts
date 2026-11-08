import pg from 'pg';
import { describe, expect, it } from 'vitest';
import type { Db } from '../src/db/index.js';
import { catalogForAi } from '../src/domains/products/service.js';
import { buildStoreFacts } from '../src/engine/store-facts.js';
import { makeMerchant, makeProduct, schema, unit, withRollback } from './harness.js';

async function seed(db: Db, merchantId: string, n: number, o: { embedded?: boolean } = {}) {
  for (let i = 1; i <= n; i++) {
    await makeProduct(db, merchantId, { name: `منتج ${i}`, price: '100.00', embedding: o.embedded === false ? null : unit(i) });
  }
}

describe('catalogForAi', () => {
  it('returns every product (and the real total) when the merchant has 40 or fewer', async () => {
    await withRollback(async (db) => {
      const m = await makeMerchant(db);
      await seed(db, m.id, 3);
      const { products, total } = await catalogForAi(db, m.id, { embedding: unit(0), query: 'سعر' });
      expect(products).toHaveLength(3);
      expect(total).toBe(3);
    });
  });

  it('returns the 8 nearest products and the full total for larger catalogs', async () => {
    await withRollback(async (db) => {
      const m = await makeMerchant(db);
      await makeProduct(db, m.id, { name: 'تيشيرت بولو', price: '350.00', embedding: unit(0) });
      await seed(db, m.id, 44);
      const { products, total } = await catalogForAi(db, m.id, { embedding: unit(0), query: 'سعر التيشيرت كام؟' });
      expect(total).toBe(45);
      expect(products).toHaveLength(8);
      expect(products.map((p) => p.name)).toContain('تيشيرت بولو');
    });
  });

  it('still finds a product whose embedding is NULL when its name matches the question', async () => {
    await withRollback(async (db) => {
      const m = await makeMerchant(db);
      await makeProduct(db, m.id, { name: 'تيشيرت بولو', price: '350.00', embedding: null });
      await seed(db, m.id, 44);
      const { products, total } = await catalogForAi(db, m.id, { embedding: unit(0), query: 'سعر التيشيرت كام؟' });
      expect(total).toBe(45);
      expect(products.map((p) => p.name)).toContain('تيشيرت بولو');
    });
  });

  it('falls back to the first 40 by name when nothing is embedded and nothing matches', async () => {
    await withRollback(async (db) => {
      const m = await makeMerchant(db);
      await seed(db, m.id, 45, { embedded: false });
      const { products, total } = await catalogForAi(db, m.id, { embedding: null, query: 'zzz' });
      expect(total).toBe(45);
      expect(products).toHaveLength(40);
    });
  });
});

describe('buildStoreFacts', () => {
  it('returns an id-free catalog for the reply and an id-tagged one for the action prompt', async () => {
    await withRollback(async (db) => {
      const m = await makeMerchant(db);
      const p = await makeProduct(db, m.id, { name: 'قميص', price: '100.00', embedding: unit(0) });
      const facts = await buildStoreFacts(db, m.id, { embedding: unit(0), query: 'قميص' });
      expect(facts.catalog).toContain('قميص');
      expect(facts.catalog).not.toContain(p.id);
      expect(facts.catalogWithIds).toContain(`[product_id=${p.id}]`);
    });
  });

  it('puts keyword-matched policies first without a second knowledge query', async () => {
    await withRollback(async (db) => {
      const m = await makeMerchant(db);
      await db.insert(schema.storeKnowledge).values([
        { merchantId: m.id, knowledgeType: 'shipping', title: 'الشحن', content: 'شحن مجاني', keywords: [] },
        { merchantId: m.id, knowledgeType: 'payment', title: 'الدفع', content: 'كاش فقط', keywords: ['دفع'] },
      ]);
      const facts = await buildStoreFacts(db, m.id, { query: 'طريقة الدفع ايه' });
      expect(facts.policies.indexOf('كاش فقط')).toBeGreaterThanOrEqual(0);
      expect(facts.policies.indexOf('كاش فقط')).toBeLessThan(facts.policies.indexOf('شحن مجاني'));
    });
  });

  it('never runs its queries concurrently on one transaction connection', async () => {
    const proto = pg.Client.prototype as unknown as { query: (...a: unknown[]) => unknown };
    const original = proto.query;
    let inflight = 0;
    let maxInflight = 0;
    proto.query = function (this: unknown, ...args: unknown[]) {
      inflight++;
      maxInflight = Math.max(maxInflight, inflight);
      const r = original.apply(this, args) as Promise<unknown> | undefined;
      const done = () => void inflight--;
      if (r && typeof r.then === 'function') void r.then(done, done);
      else done();
      return r;
    };
    try {
      await withRollback(async (db) => {
        const m = await makeMerchant(db);
        await makeProduct(db, m.id, { name: 'قميص', price: '100.00', embedding: unit(0) });
        inflight = 0;
        maxInflight = 0;
        await buildStoreFacts(db, m.id, { embedding: unit(0), query: 'قميص' });
      });
    } finally {
      proto.query = original;
    }
    expect(maxInflight).toBe(1);
  });
});
