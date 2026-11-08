import { describe, expect, it } from 'vitest';
import { detectGenderFromName, detectGenderFromText, resolveCustomerGender } from './gender.js';

describe('detectGenderFromName', () => {
  it('identifies common Arabic and Latin male names', () => {
    for (const name of ['أحمد حسن', 'محمد', 'محمود علي', 'مصطفى', 'حمزة', 'أسامة', 'عبد الرحمن', 'Ahmed', 'Mostafa', 'Karim']) {
      expect(detectGenderFromName(name), name).toBe('MALE');
    }
  });

  it('identifies common Arabic and Latin female names', () => {
    for (const name of ['سارة أحمد', 'ساره', 'مريم', 'فاطمة', 'نورهان', 'هدى', 'ياسمين', 'Sara', 'Mariam', 'Nourhan']) {
      expect(detectGenderFromName(name), name).toBe('FEMALE');
    }
  });

  it('respects gendered titles and strips neutral titles', () => {
    expect(detectGenderFromName('مدام نور')).toBe('FEMALE');
    expect(detectGenderFromName('آنسة رضا')).toBe('FEMALE');
    expect(detectGenderFromName('أستاذ نور')).toBe('MALE');
    expect(detectGenderFromName('دكتور سارة')).toBe('FEMALE');
    expect(detectGenderFromName('د. أحمد')).toBe('MALE');
    expect(detectGenderFromName('م. مريم')).toBe('FEMALE');
  });

  it('returns UNKNOWN for unisex or unknown names', () => {
    for (const name of ['نور', 'رضا', 'إسلام', 'وسام', 'جهاد', 'Nour', 'Reda', '', null, undefined, 'XYZ']) {
      expect(detectGenderFromName(name), String(name)).toBe('UNKNOWN');
    }
  });
});

describe('detectGenderFromText', () => {
  it('detects female first-person cues in Egyptian Arabic and Arabizi', () => {
    for (const msg of [
      'أنا عايزة أسأل على المقاسات',
      'عايزة فستان أسود مقاس لارج',
      'لو سمحت عاوزه اعرف السعر',
      'محتارة بين اللونين دول',
      'أنا حامل وبدور على عباية واسعة',
      'الفستان ده حلو أوي أنا عايزاه',
      'ana 3ayza a3raf el ma2asat',
      'kont mo7tara fel ma2as',
      'عايزه اعرف تفاصيل الموديل',
    ]) {
      expect(detectGenderFromText(msg), msg).toBe('FEMALE');
    }
  });

  it('detects male first-person cues in Egyptian Arabic and Arabizi', () => {
    for (const msg of [
      'أنا عايز قميص مقاس XL',
      'عاوز أعرف سعر البنطلون',
      'كنت محتار في المقاس',
      'محتاج جاكيت أسود',
      'ana 3ayez qamis',
      'kont mo7tar',
    ]) {
      expect(detectGenderFromText(msg), msg).toBe('MALE');
    }
  });

  it('uses spousal cues accurately even when buying for the opposite gender', () => {
    expect(detectGenderFromText('عايز فستان هدية لمراتي')).toBe('MALE');
    expect(detectGenderFromText('مراتي عايزة عباية سوداء')).toBe('MALE');
    expect(detectGenderFromText('زوجتي محتاجة مقاس ميديم')).toBe('MALE');
    expect(detectGenderFromText('جوزي عايز قميص كاجوال')).toBe('FEMALE');
    expect(detectGenderFromText('خطيبي محتاج بدلة')).toBe('FEMALE');
  });

  it('ignores third-person subjects so they are not mistaken for the speaker', () => {
    expect(detectGenderFromText('بنتي عايزة فستان')).toBe('UNKNOWN');
    expect(detectGenderFromText('أختي محتارة في اللون')).toBe('UNKNOWN');
    expect(detectGenderFromText('أخويا عايز قميص')).toBe('UNKNOWN');
    expect(detectGenderFromText('ابني محتاج كوتشي')).toBe('UNKNOWN');
  });

  it('returns UNKNOWN for gender-neutral messages', () => {
    for (const msg of [
      'السلام عليكم',
      'بكام الموديل ده؟',
      'المقاسات المتاحة إيه؟',
      'ممكن تفاصيل الشحن للقاهرة؟',
      'عندكم ألوان إيه من الموديل ده؟',
      'عايزين نعرف السعر',
    ]) {
      expect(detectGenderFromText(msg), msg).toBe('UNKNOWN');
    }
  });
});

describe('resolveCustomerGender', () => {
  it('prioritizes current message cue -> slots.customer_gender -> history -> slots.customer_name', () => {
    // 1. Current message wins
    expect(
      resolveCustomerGender({
        text: 'أنا عايزة الموديل ده',
        slots: { customer_name: 'نور' },
      }),
    ).toBe('FEMALE');

    // 2. Persisted slot gender used when current text is neutral
    expect(
      resolveCustomerGender({
        text: 'بكام الشحن؟',
        slots: { customer_gender: 'FEMALE' },
      }),
    ).toBe('FEMALE');

    // 3. History inbound message used when slot is empty and current text is neutral
    expect(
      resolveCustomerGender({
        text: 'طب اللون الأسود متاح؟',
        slots: {},
        history: [
          { direction: 'INBOUND', normalizedText: 'أنا عايز أعرف المقاسات' },
          { direction: 'OUTBOUND', normalizedText: 'أهلاً بحضرتك' },
        ],
      }),
    ).toBe('MALE');

    // 4. Customer name in slots used as fallback
    expect(
      resolveCustomerGender({
        text: 'تمام شكراً',
        slots: { customer_name: 'مريم' },
      }),
    ).toBe('FEMALE');

    // 5. Unknown when no signal exists
    expect(
      resolveCustomerGender({
        text: 'بكام ده؟',
        slots: { customer_name: 'نور' },
      }),
    ).toBe('UNKNOWN');
  });
});
