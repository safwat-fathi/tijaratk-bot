import { describe, expect, it } from 'vitest';
import { isOfferActive, resolveUnitPrice } from './offers.js';

const now = new Date('2026-11-06T12:00:00Z');
const product = (offerPrice: string | null, endsAt: string | null) => ({
  price: '100.00',
  offerPrice,
  offerEndsAt: endsAt ? new Date(endsAt) : null,
});

describe('offers', () => {
  it('is active with no end date, or before the end; inactive after or without a price', () => {
    expect(isOfferActive(product('80.00', null), now)).toBe(true);
    expect(isOfferActive(product('80.00', '2026-11-07T00:00:00Z'), now)).toBe(true);
    expect(isOfferActive(product('80.00', '2026-11-05T00:00:00Z'), now)).toBe(false);
    expect(isOfferActive(product(null, null), now)).toBe(false);
  });

  it('uses the offer price for the product, the regular price once it ends, and a variant own price always', () => {
    expect(resolveUnitPrice(product('80.00', null), null, now)).toBe('80.00');
    expect(resolveUnitPrice(product('80.00', '2026-11-05T00:00:00Z'), null, now)).toBe('100.00');
    expect(resolveUnitPrice(product('80.00', null), { price: null }, now)).toBe('80.00');
    expect(resolveUnitPrice(product('80.00', null), { price: '120.00' }, now)).toBe('120.00');
  });
});
