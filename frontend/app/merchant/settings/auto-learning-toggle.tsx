"use client";

import { useState } from "react";
import { updateAutoLearningAction } from "@/app/demo/actions";

export function AutoLearningToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    setError(null);
    try {
      await updateAutoLearningAction(next);
    } catch (err) {
      setEnabled(!next);
      setError(err instanceof Error ? err.message : "فشل حفظ الإعداد");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-slate-900">التعلم المستمر</p>
        <p className="text-sm text-slate-500">
          يتعلم الـ AI تلقائيًا من محادثاتك السابقة ويضيف أمثلة تدريب جديدة (تظهر في صفحة تدريب الـ AI).
        </p>
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        role="switch"
        aria-checked={enabled}
        className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
          enabled ? "bg-blue-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 start-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            enabled ? "rtl:-translate-x-5 ltr:translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
