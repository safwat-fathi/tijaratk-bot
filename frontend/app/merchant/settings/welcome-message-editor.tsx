"use client";

import { useState } from "react";
import { updateWelcomeMessageAction } from "@/app/demo/actions";

export function WelcomeMessageEditor({ initialMessage }: { initialMessage: string }) {
  const [message, setMessage] = useState(initialMessage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateWelcomeMessageAction(message);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حفظ الرسالة");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-medium text-slate-900">رسالة الترحيب</p>
        <p className="text-sm text-slate-500 mb-2">
          الرسالة التي يتم إرسالها للعميل عند بدء المحادثة. يمكنك استخدام <code dir="ltr">{"{store_name}"}</code> لطباعة اسم متجرك تلقائيًا.
        </p>
      </div>
      <div className="space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={saving}
          rows={3}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:opacity-50"
          dir="rtl"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !message.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? "جاري الحفظ..." : "حفظ الرسالة"}
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
          {success && <span className="text-sm text-green-600">تم الحفظ بنجاح!</span>}
        </div>
      </div>
    </div>
  );
}
