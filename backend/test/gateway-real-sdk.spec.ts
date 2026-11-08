import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { setSettingsForTests } from '../src/config.js';
import { AICallError, readCompletion, setAiClientsForTests } from '../src/engine/clients.js';
import { embed } from '../src/engine/gateway.js';
import { generateReply } from '../src/engine/generation.js';

/** A minimal OpenAI-compatible server so the REAL openai SDK (retries, auth, body parsing) is exercised. */
function serve(handler: (req: http.IncomingMessage, body: any, res: http.ServerResponse) => void) {
  const seen: any[] = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      seen.push({ url: req.url, auth: req.headers.authorization, body });
      handler(req, body, res);
    });
  });
  return new Promise<{ url: string; seen: any[]; close: () => Promise<void> }>((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
        seen,
        close: () => new Promise((r) => server.close(() => r())),
      }),
    ),
  );
}

const completion = (content: string) => ({
  id: 'x', object: 'chat.completion', created: 1, model: 'm',
  choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
  usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
});

const sse = (parts: string[], usage = true) =>
  [
    ...parts.map((p) => `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: p } }] })}\n\n`),
    ': keep-alive comment\n\n',
    ...(usage ? [`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 21, completion_tokens: 9 } })}\n\n`] : []),
    'data: [DONE]\n\n',
  ].join('');

afterEach(() => {
  setSettingsForTests(undefined);
  setAiClientsForTests(undefined);
});

async function against(server: { url: string }) {
  setSettingsForTests({ OPENROUTER_BASE_URL: server.url, EMBEDDING_BASE_URL: server.url, OPENROUTER_API_KEY: 'k1', EMBEDDING_API_KEY: 'k2', AI_MAX_RETRIES: 0 });
  setAiClientsForTests(undefined); // rebuild real clients from the new settings
}

describe('real openai SDK against an OpenAI-compatible endpoint', () => {
  it('plain JSON completion: parsed, usage recorded, OpenRouter provider order + json_schema sent', async () => {
    const s = await serve((_req, _b, res) => (res.setHeader('content-type', 'application/json'), res.end(JSON.stringify(completion('{"reply":"أهلاً"}')))));
    try {
      await against(s);
      const [reply, usage] = await generateReply({ userPrompt: 'hi', merchantName: 'M', convState: 'NEW', slots: {} });
      expect(reply).toEqual({ reply: 'أهلاً', needs_human: false });
      expect(usage).toMatchObject({ inputTokens: 11, outputTokens: 7, provider: 'openrouter', tier: 'deepseek' });
      const sent = s.seen[0];
      expect(sent.url).toBe('/v1/chat/completions');
      expect(sent.auth).toBe('Bearer k1');
      expect(sent.body).toMatchObject({ stream: false, max_tokens: 4096, provider: { order: ['DeepSeek', 'Fireworks', 'Together'] } });
      expect(sent.body.response_format.json_schema.name).toBe('generated_reply');
      expect(sent.body.messages.map((m: any) => m.role)).toEqual(['system', 'user']);
    } finally {
      await s.close();
    }
  });

  it('the ~deepseek route streams SSE even with stream=false: chunks are aggregated, usage kept', async () => {
    const s = await serve((_req, _b, res) => (res.setHeader('content-type', 'text/event-stream'), res.end(sse(['{"reply":', '"أهلاً ', 'بيك"}']))));
    try {
      await against(s);
      const [reply, usage] = await generateReply({ userPrompt: 'hi', merchantName: 'M', convState: 'NEW', slots: {} });
      expect(reply).toEqual({ reply: 'أهلاً بيك', needs_human: false });
      expect(usage).toMatchObject({ inputTokens: 21, outputTokens: 9 });
    } finally {
      await s.close();
    }
  });

  it('HTTP errors become AICallError (auth, 5xx); garbage content becomes AICallError', async () => {
    let mode = 401;
    const s = await serve((_r, _b, res) => {
      if (mode === 200) return (res.setHeader('content-type', 'application/json'), res.end(JSON.stringify(completion('not json at all'))));
      res.statusCode = mode;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: { message: 'nope' } }));
    });
    try {
      await against(s);
      const call = () => generateReply({ userPrompt: 'hi', merchantName: 'M', convState: 'NEW', slots: {} });
      await expect(call()).rejects.toBeInstanceOf(AICallError);
      mode = 503;
      await expect(call()).rejects.toBeInstanceOf(AICallError);
      mode = 200;
      await expect(call()).rejects.toThrow(/non-json content/);
    } finally {
      await s.close();
    }
  });

  it('connection refused is an AICallError too', async () => {
    setSettingsForTests({ OPENROUTER_BASE_URL: 'http://127.0.0.1:9/v1', AI_MAX_RETRIES: 0 });
    setAiClientsForTests(undefined);
    await expect(generateReply({ userPrompt: 'hi', merchantName: 'M', convState: 'NEW', slots: {} })).rejects.toBeInstanceOf(AICallError);
  });

  it('embeddings: 1024-dim vector returned as plain numbers', async () => {
    const s = await serve((_r, _b, res) => (res.setHeader('content-type', 'application/json'), res.end(JSON.stringify({ object: 'list', model: 'm', data: [{ object: 'embedding', index: 0, embedding: new Array(1024).fill(0.5) }], usage: { prompt_tokens: 1, total_tokens: 1 } }))));
    try {
      await against(s);
      const v = await embed('نص');
      expect(v).toHaveLength(1024);
      expect(s.seen[0]).toMatchObject({ url: '/v1/embeddings', auth: 'Bearer k2', body: { model: 'test-embed', input: 'نص' } });
    } finally {
      await s.close();
    }
  });
});

describe('readCompletion', () => {
  it('ignores malformed / comment / empty SSE lines and tolerates a missing usage chunk', async () => {
    const res = new Response(`: ping\n\ndata: {oops\n\ndata: ${JSON.stringify({ choices: [{ delta: { content: 'ok' } }] })}\n\ndata:\n\ndata: [DONE]\n`, { headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
    expect(await readCompletion(res)).toMatchObject({ choices: [{ message: { content: 'ok' } }], usage: null });
  });
});
