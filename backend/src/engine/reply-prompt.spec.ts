import { describe, expect, it } from 'vitest';
import { buildReplySystemPrompt } from './prompts.js';

const base = { merchantName: 'متجر النور', convState: 'NEW' as const, slots: {} };

describe('buildReplySystemPrompt', () => {
  it('keeps $ replacement patterns in the merchant name literal', () => {
    const a = buildReplySystemPrompt({ ...base, merchantName: 'Shop $& Mart' });
    expect(a).toContain("Shop $& Mart's sales assistant");
    const b = buildReplySystemPrompt({ ...base, merchantName: "Ali$'s" });
    expect(b).toContain("Ali$'s's sales assistant");
    expect(a).not.toContain('{merchant_name}');
    expect(b).not.toContain('{merchant_name}');
  });

  it('omits the store facts section when no facts were supplied (e.g. a greeting)', () => {
    const p = buildReplySystemPrompt(base);
    expect(p).not.toContain('STORE FACTS');
    expect(p).not.toContain('لا توجد منتجات مسجلة');
    expect(p).toContain('CONVERSATION STATE');
  });

  it('shows the facts section, with empty placeholders, once facts were supplied', () => {
    const p = buildReplySystemPrompt({ ...base, catalog: '', policies: '' });
    expect(p).toContain('STORE FACTS');
    expect(p).toContain('لا توجد منتجات مسجلة');
  });

  it('tells the model not to call a product unavailable when the catalog is a partial list', () => {
    expect(buildReplySystemPrompt({ ...base, catalog: 'x', policies: 'y' })).toContain('partial list');
  });
});
