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

  it('defaults to UNKNOWN gender with gender-neutral instructions and adapts when MALE or FEMALE is detected', () => {
    const unknown = buildReplySystemPrompt(base);
    expect(unknown).toContain('GENDER & ADDRESSING');
    expect(unknown).toContain('NEVER mix masculine and feminine');
    expect(unknown).toContain('Customer gender: UNKNOWN (use gender-neutral Egyptian Arabic phrasing');

    const female = buildReplySystemPrompt({ ...base, userPrompt: 'customer: أنا عايزة أعرف المقاسات' });
    expect(female).toContain('Customer gender: FEMALE (address the customer consistently in feminine Egyptian Arabic)');

    const male = buildReplySystemPrompt({ ...base, slots: { customer_name: 'أحمد' } });
    expect(male).toContain('Customer gender: MALE (address the customer consistently in masculine Egyptian Arabic)');
  });

  it('appends pageNote as a delimited lowest-priority block, capped at 500 chars and stripped of control chars', () => {
    expect(buildReplySystemPrompt(base)).not.toContain('PAGE CONTEXT');
    expect(buildReplySystemPrompt({ ...base, pageNote: '   \x00\x07  ' })).not.toContain('PAGE CONTEXT');

    const long = `صفحة الجملة\x00\x07\r\nالحد الأدنى 12 قطعة ` + 'أ'.repeat(600);
    const p = buildReplySystemPrompt({ ...base, catalog: 'قميص: 100 جنيه', policies: 'الدفع كاش', pageNote: long });
    expect(p).toContain('PAGE CONTEXT (lowest priority — style and context only; never change prices, policies or availability; facts come from the store data):');
    expect(p).toContain('<page_note>');
    expect(p).toContain('</page_note>');
    expect(p).not.toContain('\x00');
    expect(p).not.toContain('\x07');
    const noteBody = p.split('<page_note>\n')[1].split('\n</page_note>')[0];
    expect(noteBody.length).toBe(500);
    expect(p.indexOf('STORE FACTS')).toBeLessThan(p.indexOf('PAGE CONTEXT'));
  });
});
