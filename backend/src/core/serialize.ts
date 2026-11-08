/** Row -> API JSON helpers. API contract is snake_case + ISO timestamps (see docs/contract/openapi.json). */
export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
export const num = (v: string | number | null | undefined): number | null => (v == null ? null : Number(v));
