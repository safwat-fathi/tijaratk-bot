import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ExtractionBase, GeneratedReply, ProposedAction, jsonSchemaResponseFormat } from './schemas.js';

const golden = JSON.parse(readFileSync(new URL('../../../docs/contract/golden.json', import.meta.url), 'utf8')).json_schemas;

type J = Record<string, any>;

/** Canonical, comparable description of a JSON schema node: types, enums, bounds, nested shapes, required-ness. */
function sig(node: J, defs: J): any {
  if (node.$ref) return sig(defs[node.$ref.split('/').pop()!], defs);
  if (node.anyOf || node.oneOf) {
    const alts = (node.anyOf ?? node.oneOf).map((n: J) => sig(n, defs));
    // type:[a,b] and anyOf:[{type:a},{type:b}] are the same union
    return { union: alts.flatMap((a: any) => (a.union ? a.union : [a])).map((a: any) => JSON.stringify(a)).sort() };
  }
  if (Array.isArray(node.type)) return { union: node.type.map((t: string) => JSON.stringify({ type: t })).sort() };
  const out: J = { type: node.type };
  if (node.const !== undefined) out.const = node.const;
  if (node.enum) out.enum = [...node.enum].sort();
  for (const k of ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength', 'maxLength']) if (node[k] !== undefined) out[k] = node[k];
  if (node.type === 'array') out.items = node.items ? sig(node.items, defs) : null;
  if (node.type === 'object' && node.properties) out.shape = objectSig(node, defs);
  if (node.type === 'object' && node.additionalProperties && typeof node.additionalProperties === 'object') out.values = sig(node.additionalProperties, defs);
  return out;
}

function objectSig(node: J, defs: J) {
  return {
    required: [...(node.required ?? [])].sort(),
    props: Object.fromEntries(Object.entries<J>(node.properties ?? {}).map(([k, v]) => [k, sig(v, defs)]).sort(([a], [b]) => String(a).localeCompare(String(b)))),
  };
}

const ours = (schema: z.ZodType) => jsonSchemaResponseFormat(schema, 'n').json_schema.schema as J;

describe('structured-output JSON schema parity with pydantic', () => {
  it('extraction: same properties, types, bounds, required set (incl. nested line items)', () => {
    const py = golden.extraction;
    expect(objectSig(ours(ExtractionBase as z.ZodType), {})).toEqual(objectSig(py, py.$defs ?? {}));
  });

  it('reply', () => {
    expect(objectSig(ours(GeneratedReply), {})).toEqual(objectSig(golden.reply, {}));
  });

  it('intent (enum of known intents) - the shape classification sends upstream', () => {
    const py = golden.intent;
    const mine = ours(z.object({ intent: z.enum(['greeting', 'other', 'purchase_intent']), confidence: z.number().min(0).max(1) }));
    expect(objectSig(mine, {})).toEqual(objectSig(py, py.$defs ?? {}));
    expect(objectSig(mine, {}).props.confidence).toMatchObject({ minimum: 0, maximum: 1 });
  });

  it('every action branch matches by name: fields, bounds (quantity > 0, query minLength 1), required', () => {
    const py = golden.action;
    const defs = py.$defs ?? {};
    const pyBranches = (py.oneOf ?? py.anyOf).map((b: J) => (b.$ref ? defs[b.$ref.split('/').pop()!] : b));
    const mine = (ours(ProposedAction).oneOf ?? ours(ProposedAction).anyOf) as J[];
    const byName = (branches: J[]) => Object.fromEntries(branches.map((b) => [b.properties.action.const ?? b.properties.action.enum[0], b]));
    const a = byName(mine);
    const b = byName(pyBranches);
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    expect(Object.keys(a)).toHaveLength(11);
    for (const name of Object.keys(b)) {
      expect(objectSig(a[name], {}), name).toEqual(objectSig(b[name], defs));
    }
  });
});
