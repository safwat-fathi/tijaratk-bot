/** Exact 2-dp money math (Python used Decimal; floats would drift). Values travel as strings like "12.50". */

const SCALE = 1_000_000n; // quantity precision

function toBigScaled(n: number | string, scale = SCALE): bigint {
  const s = typeof n === 'number' ? n.toFixed(6) : n;
  const neg = s.startsWith('-');
  const [i, f = ''] = s.replace('-', '').split('.');
  const digits = BigInt(i + f.padEnd(6, '0').slice(0, 6));
  return (neg ? -digits : digits) * (scale / SCALE);
}

export const toCents = (price: string | number): bigint => (toBigScaled(price) + 5000n) / 10_000n; // price already 2dp

function roundHalfEven(num: bigint, den: bigint): bigint {
  let q = num / den;
  const r = num % den;
  const twice = r * 2n;
  if (twice > den || (twice === den && q % 2n !== 0n)) q += 1n;
  return q;
}

/** Exact unit_price * quantity, in 1e-6 cents (sum these, then round once - Decimal semantics). */
export function scaledProduct(unitPrice: string | number, quantity: number): bigint {
  return toCents(unitPrice) * toBigScaled(quantity);
}

/** Round a scaledProduct (or sum of them) to cents with ROUND_HALF_EVEN, like Decimal.quantize. */
export const roundScaledToCents = (scaled: bigint): bigint => roundHalfEven(scaled, SCALE);

export const lineTotalCents = (unitPrice: string | number, quantity: number): bigint =>
  roundScaledToCents(scaledProduct(unitPrice, quantity));

export const centsToString = (c: bigint): string => {
  const neg = c < 0n;
  const abs = neg ? -c : c;
  return `${neg ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
};

/** Python Decimal(str(x)).quantize(Decimal("0.01")) for an input number. */
export const quantize2 = (value: number | string): string => centsToString(roundHalfEven(toBigScaled(value) * 100n, SCALE));
