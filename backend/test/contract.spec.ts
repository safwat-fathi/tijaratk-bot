import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { withApp } from './harness.js';

const contract = JSON.parse(readFileSync(new URL('../../docs/contract/openapi.json', import.meta.url), 'utf8'));
const routes: [string, string][] = Object.entries(contract.paths).flatMap(([path, ops]: [string, any]) =>
  Object.keys(ops).map((method) => [method, path] as [string, string]),
);

describe('OpenAPI contract: every FastAPI route exists on the Nest server', () => {
  it('has the expected number of routes', () => expect(routes.length).toBeGreaterThanOrEqual(30));

  it('serves every (method, path) - a missing route would answer "Cannot METHOD /path"', async () => {
    await withApp(async ({ http }) => {
      const missing: string[] = [];
      for (const [method, path] of routes) {
        const url = path.replace(/\{[^}]+\}/g, 'x');
        const res = await (http as any)[method](url).send({});
        const body = JSON.stringify(res.body) + res.text;
        if (res.status === 404 && /Cannot (GET|POST|PUT|PATCH|DELETE)/.test(body)) missing.push(`${method.toUpperCase()} ${path}`);
      }
      expect(missing).toEqual([]);
    });
  });
});
