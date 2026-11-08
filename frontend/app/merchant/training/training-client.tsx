"use client";

import { useState } from "react";
import { useMerchantData } from "@/lib/use-merchant-data";
import {
  fetchExamplesAction,
  createExampleAction,
  updateExampleAction,
  deleteExampleAction,
} from "@/app/merchant/actions";
import { type LabeledExample } from "@/lib/training";

const SOURCE_LABELS: Record<string, string> = {
  merchant: "يدوي",
  cluster_labeling: "تلقائي",
};

export function TrainingClient({
  merchantId,
  initialExamples,
  intents,
}: {
  merchantId: string;
  initialExamples: LabeledExample[];
  intents: string[];
}) {
  const { data: examples, refresh } = useMerchantData<LabeledExample[]>(
    fetchExamplesAction,
    merchantId,
    initialExamples,
  );
  const [text, setText] = useState("");
  const [intent, setIntent] = useState("");
  const [extraction, setExtraction] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editIntent, setEditIntent] = useState("");
  const [editExtraction, setEditExtraction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !intent.trim()) return;
    
    let parsedExtraction: Record<string, unknown> | null = null;
    if (extraction.trim()) {
      try {
        parsedExtraction = JSON.parse(extraction.trim());
      } catch (err) {
        setError("خطأ في صيغة الـ JSON في حقل البيانات المستخرجة");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      await createExampleAction({ 
        normalized_text: text.trim(), 
        intent: intent.trim(),
        extraction: parsedExtraction
      });
      setText("");
      setIntent("");
      setExtraction("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string) {
    let parsedExtraction: Record<string, unknown> | null = null;
    if (editExtraction.trim()) {
      try {
        parsedExtraction = JSON.parse(editExtraction.trim());
      } catch (err) {
        setError("خطأ في صيغة الـ JSON في حقل البيانات المستخرجة");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      await updateExampleAction(id, { 
        normalized_text: editText.trim(), 
        intent: editIntent.trim(),
        extraction: parsedExtraction
      });
      setEditingId(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التحديث");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteExampleAction(id);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الحذف");
    }
  }

  function startEdit(ex: LabeledExample) {
    setEditingId(ex.id);
    setEditText(ex.normalized_text);
    setEditIntent(ex.intent);
    setEditExtraction(ex.extraction ? JSON.stringify(ex.extraction, null, 2) : "");
  }

  return (
    <div className="font-sans">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">تدريب الـ AI</h1>
        <p className="text-slate-500 mt-1">
          أضف أمثلة من رسائل عملائك لتعليم الـ AI تصنيف نية الرسالة (طلب شراء، سؤال، شكوى...) واستخراج الأصناف المطلوبة. لإضافة تعليمات الرد أو قواعد الأسعار أو سياسات الشحن والاسترجاع، استخدم صفحة <a href="/merchant/policies" className="text-blue-600 underline hover:text-blue-700">السياسات</a>.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">رسالة العميل</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="مثال: عايز أطلب ٢ كيلو طماطم"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">التصنيف (intent)</label>
            <input
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              list="intent-suggestions"
              placeholder="purchase_intent أو تصنيف خاص بيك"
              dir="ltr"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <datalist id="intent-suggestions">
              {intents.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
            <p className="text-xs text-slate-400 mt-1">snake_case — حروف إنجليزية صغيرة وشرطات سفلية فقط</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">البيانات المستخرجة (JSON إختياري)</label>
            <textarea
              value={extraction}
              onChange={(e) => setExtraction(e.target.value)}
              placeholder='{"product_name": "طماطم", "quantity": "٢ كيلو"}'
              dir="ltr"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving || !text.trim() || !intent.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            إضافة مثال
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {examples.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">لا توجد أمثلة بعد. أضف أول مثال أعلاه.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {examples.map((ex) => (
              <li key={ex.id} className="p-4 flex items-start justify-between gap-4">
                {editingId === ex.id ? (
                  <div className="flex-1 space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      rows={2}
                    />
                    <input
                      value={editIntent}
                      onChange={(e) => setEditIntent(e.target.value)}
                      dir="ltr"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-left"
                    />
                    <textarea
                      value={editExtraction}
                      onChange={(e) => setEditExtraction(e.target.value)}
                      placeholder='{"product_name": "طماطم", "quantity": "٢ كيلو"}'
                      dir="ltr"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-left"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(ex.id)}
                        disabled={saving}
                        className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg disabled:opacity-50"
                      >
                        حفظ
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 border border-slate-300 text-slate-600 text-xs font-medium rounded-lg"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900">{ex.normalized_text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-mono rounded" dir="ltr">
                          {ex.intent}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded">
                          {SOURCE_LABELS[ex.source] ?? ex.source}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(ex)}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDelete(ex.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        حذف
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
