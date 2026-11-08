import { Logger } from '@nestjs/common';
import { cpSlice } from '../core/pystr.js';
import type { DbOrTx } from '../db/index.js';
import { isOfferActive, resolveUnitPrice } from '../domains/products/offers.js';
import { type ProductRead, catalogForAi } from '../domains/products/service.js';
import * as knowledge from '../domains/store-knowledge/service.js';

const log = new Logger('store-facts');
const POLICY_CHAR_BUDGET = 3000;

export interface StoreFacts {
  catalog: string; // no ids: safe to show the customer-facing reply model
  catalogWithIds: string; // for the action prompt, which must cite product_id / variant_id
  policies: string;
}

export function formatCatalog(
  products: ProductRead[],
  o: { currency?: string; withIds?: boolean; now?: Date; total?: number } = {},
): string {
  if (!products.length) return '(لا توجد منتجات مسجلة)';
  const now = o.now ?? new Date();
  const curr = !o.currency || o.currency === 'EGP' ? 'جنيه' : o.currency;
  const lines: string[] =
    o.total !== undefined && o.total > products.length
      ? [`(قائمة جزئية: ${products.length} من ${o.total} منتج. لو المنتج اللي العميل بيسأل عنه مش ظاهر، ممكن يكون موجود.)`]
      : [];

  for (const p of products) {
    const offerProduct = {
      price: p.price != null ? String(p.price) : null,
      offerPrice: p.offer_price != null ? String(p.offer_price) : null,
      offerEndsAt: p.offer_ends_at ? new Date(p.offer_ends_at) : null,
    };
    const active = isOfferActive(offerProduct, now);
    const unitPrice = resolveUnitPrice(offerProduct, null, now);
    const idTag = o.withIds ? `[product_id=${p.id}] ` : '';
    const aliases = p.aliases?.length ? ` (${p.aliases.join(', ')})` : '';

    let pricePart: string;
    if (active && unitPrice !== null) {
      const ends = p.offer_ends_at ? ` حتى ${p.offer_ends_at.slice(0, 10)}` : '';
      const orig = p.price != null ? ` بدلاً من ${p.price} ${curr}` : '';
      pricePart = `${unitPrice} ${curr} (عرض${orig}${ends})`;
    } else if (unitPrice !== null) {
      pricePart = `${unitPrice} ${curr}`;
    } else {
      pricePart = '(السعر حسب المقاس/النوع)';
    }

    const desc = p.description ? ` — ${p.description}` : '';
    lines.push(`- ${idTag}${p.name}${aliases}: ${pricePart}${desc}`);

    for (const v of p.variants ?? []) {
      const vIdTag = o.withIds ? `[variant_id=${v.id}] ` : '';
      const vPrice = resolveUnitPrice(offerProduct, { price: v.price != null ? String(v.price) : null }, now);
      const avail = v.status === 'ACTIVE' && (v.stock === null || v.stock > 0) ? 'متاح' : 'غير متاح';
      const vPriceText = vPrice !== null ? `${vPrice} ${curr}` : 'بدون سعر';
      lines.push(`  * ${vIdTag}${v.label}: ${vPriceText} (${avail})`);
    }
  }
  return lines.join('\n');
}

const MIN_TRUNCATED_POLICY = 40;

export function formatPolicies(
  matched: { id: string }[],
  all: knowledge.StoreKnowledgeRead[],
  budget = POLICY_CHAR_BUDGET,
): { text: string; dropped: number; truncated: number } {
  if (!all.length) return { text: '(لا توجد سياسات مسجلة)', dropped: 0, truncated: 0 };
  const byId = new Map(all.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const ordered: knowledge.StoreKnowledgeRead[] = [];

  for (const m of matched) {
    const row = byId.get(m.id);
    if (row && !seen.has(row.id)) {
      seen.add(row.id);
      ordered.push(row);
    }
  }
  // Remaining entries oldest-first (listKnowledge returns newest-first) for a stable prefix.
  for (const row of [...all].reverse()) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      ordered.push(row);
    }
  }

  const lines: string[] = [];
  let len = 0;
  let dropped = 0;
  let truncated = 0;
  for (const r of ordered) {
    const line = `- [${r.knowledge_type}] ${r.title}: ${r.content}`;
    const sep = lines.length ? 1 : 0;
    const room = budget - len - sep;
    if (line.length <= room) {
      lines.push(line);
      len += sep + line.length;
    } else if (room >= MIN_TRUNCATED_POLICY || (!lines.length && room > 1)) {
      // An over-long policy is cut, never dropped: dropping it would tell the model there is no such policy.
      const cut = `${cpSlice(line, room - 1)}…`;
      lines.push(cut);
      len += sep + cut.length;
      truncated++;
    } else {
      dropped++;
    }
  }
  return { text: lines.join('\n'), dropped, truncated };
}

export async function buildStoreFacts(
  db: DbOrTx,
  merchantId: string,
  o: { embedding?: number[] | null; query?: string; currency?: string } = {},
): Promise<StoreFacts> {
  // Sequential on purpose: a transaction is a single connection, and pg deprecates overlapping queries on it.
  const { products, total } = await catalogForAi(db, merchantId, { embedding: o.embedding, query: o.query });
  const all = await knowledge.listKnowledge(db, merchantId);
  const matched = o.query ? knowledge.matchKnowledge(all, o.query) : [];

  const fmt = { currency: o.currency, total };
  const { text: policies, dropped, truncated } = formatPolicies(matched, all);
  if (dropped > 0 || truncated > 0) {
    log.warn(`store_policies_trimmed merchant_id=${merchantId} dropped=${dropped} truncated=${truncated}`);
  }
  return {
    catalog: formatCatalog(products, fmt),
    catalogWithIds: formatCatalog(products, { ...fmt, withIds: true }),
    policies,
  };
}
