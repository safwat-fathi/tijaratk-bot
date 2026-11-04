/** Python-compat string helpers (code-point lengths, str.strip with a char set, json.dumps(ensure_ascii=False)). */
export const cpLen = (s: string): number => [...s].length;

export function stripChars(s: string, chars: string): string {
  const set = new Set(chars);
  const cps = [...s];
  let a = 0;
  let b = cps.length;
  while (a < b && set.has(cps[a])) a++;
  while (b > a && set.has(cps[b - 1])) b--;
  return cps.slice(a, b).join('');
}

/** Matches Python json.dumps(obj, ensure_ascii=False): ", " and ": " separators. */
export function pyJsonDumps(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(pyJsonDumps).join(', ')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${JSON.stringify(k)}: ${pyJsonDumps(v)}`)
      .join(', ')}}`;
  }
  return JSON.stringify(value);
}

export const cpSlice = (s: string, n: number): string => [...s].slice(0, n).join('');

/** Python str(float): 100.0 -> "100.0", 12.5 -> "12.5". */
export const pyFloat = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** Python f"{n:.0f}" (round-half-even on exact halves). */
export function fmt0(n: number): string {
  const f = Math.floor(n);
  const diff = n - f;
  const r = diff === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(n);
  return String(r);
}
