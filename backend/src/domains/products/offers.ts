/** An offer is a sale price on the product, optionally ending at a date. Pure helpers so pricing paths share one rule. */
type OfferFields = { offerPrice: string | null; offerEndsAt: Date | null };

export const isOfferActive = (p: OfferFields, now = new Date()): boolean =>
  p.offerPrice !== null && (p.offerEndsAt === null || p.offerEndsAt > now);

/**
 * Unit price for a cart/order line. A variant's own price wins (an explicit price is the merchant's final word);
 * otherwise the product price, replaced by the offer price while the offer is active.
 */
export function resolveUnitPrice(
  product: OfferFields & { price: string | null },
  variant: { price: string | null } | null,
  now = new Date(),
): string | null {
  if (variant && variant.price !== null) return variant.price;
  return isOfferActive(product, now) ? product.offerPrice : product.price;
}
