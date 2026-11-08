"use client";

import { useState } from "react";
import * as m from "@/paraglide/messages";
import type { StoreKnowledge } from "@/lib/knowledge";
import { createKnowledgeAction, deleteKnowledgeAction, updateKnowledgeAction } from "@/app/merchant/actions";

const KNOWLEDGE_TYPES = [
  { value: "shipping", label: "Shipping / توصيل" },
  { value: "returns", label: "Returns / استرجاع" },
  { value: "exchange", label: "Exchange / استبدال" },
  { value: "payment", label: "Payment / طرق الدفع" },
  { value: "faq", label: "FAQ / أسئلة شائعة" },
  { value: "general", label: "General / عام" },
];

export function StoreKnowledgeView({
  knowledge,
  merchantId,
  onRefresh,
  readOnly = false,
}: {
  knowledge: StoreKnowledge[];
  merchantId?: string;
  onRefresh?: () => void;
  readOnly?: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreKnowledge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [knowledgeType, setKnowledgeType] = useState("shipping");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [keywords, setKeywords] = useState("");

  const openAddModal = () => {
    setEditingItem(null);
    setKnowledgeType("shipping");
    setTitle("");
    setContent("");
    setKeywords("");
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: StoreKnowledge) => {
    setEditingItem(item);
    setKnowledgeType(item.knowledge_type);
    setTitle(item.title);
    setContent(item.content);
    setKeywords((item.keywords || []).join(", "));
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const parsedKeywords = keywords
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (editingItem) {
        await updateKnowledgeAction(
          editingItem.id,
          {
            knowledge_type: knowledgeType,
            title,
            content,
            keywords: parsedKeywords,
          },
          merchantId
        );
      } else {
        await createKnowledgeAction(
          {
            knowledge_type: knowledgeType,
            title,
            content,
            keywords: parsedKeywords,
          },
          merchantId
        );
      }

      setModalOpen(false);
      onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this policy?")) return;
    setLoading(true);
    try {
      await deleteKnowledgeAction(id, merchantId);
      onRefresh?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold tracking-tight">{m.demo_tab_knowledge()}</h2>
        {!readOnly && (
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            إضافة معلومات
          </button>
        )}
      </div>

      {knowledge.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">{m.demo_knowledge_empty()}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 group">
          {knowledge.map((item) => (
            <div key={item.id} className="relative flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-xs hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    {item.knowledge_type}
                  </span>
                  <h3 className="font-medium text-gray-900">{item.title}</h3>
                </div>

                {/* Action Buttons: Edit / Delete */}
                {!readOnly && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditModal(item)}
                      title="Edit info"
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-emerald-700 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      title="Delete info"
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.content}</p>

              {item.keywords && item.keywords.length > 0 && (
                <div className="mt-2 border-t border-gray-100 pt-2.5">
                  <p className="mb-1.5 text-xs font-medium text-gray-500">{m.demo_knowledge_keywords()}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Policy Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h3 className="font-semibold text-lg text-gray-900">
                {editingItem ? "تعديل السياسة" : "إضافة سياسة / معلومات"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-50"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">الفئة</label>
                <select
                  value={knowledgeType}
                  onChange={(e) => setKnowledgeType(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none bg-white"
                >
                  {KNOWLEDGE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">العنوان</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: سياسة الشحن والتوصيل"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">تفاصيل السياسة</label>
                <textarea
                  required
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="مثال: التوصيل لجميع المحافظات خلال 3-5 أيام عمل وداخل القاهرة 50 جنيه."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  كلمات مفتاحية (اختياري — مفصولة بفاصلة)
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="مثال: شحن, توصيل, مصاريف, القاهرة"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  يقرأ الذكاء الاصطناعي جميع السياسات المضافة هنا في كل رد. الكلمات المفتاحية اختيارية وتُستخدم فقط لإعطاء أولوية للسياسة عند كثرة السياسات.
                </p>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
                >
                  {loading ? "جاري الحفظ..." : editingItem ? "حفظ التغييرات" : "إنشاء سياسة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
