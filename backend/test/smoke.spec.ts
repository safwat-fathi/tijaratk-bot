import { describe, expect, it } from 'vitest';
import { withApp } from './harness.js';

describe('smoke', () => {
  it('boots and serves /health in FastAPI shape', async () => {
    await withApp(async ({ http }) => {
      const res = await http.get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok', version: '0.1.0' });
      const unauth = await http.get('/products');
      expect(unauth.status).toBe(401);
      expect(unauth.body).toEqual({ detail: 'not authenticated' });
    });
  });
});
