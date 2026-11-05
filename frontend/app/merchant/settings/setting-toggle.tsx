"use client";

import { useState } from "react";

type SettingToggleProps = {
  title: string;
  description: string;
  initialEnabled: boolean;
  onChange: (enabled: boolean) => Promise<unknown>;
};

export function SettingToggle({ title, description, initialEnabled, onChange }: SettingToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    setError(null);
    try {
      await onChange(next);
    } catch (err) {
      setEnabled(!next);
      setError(err instanceof Error ? err.message : "فشل حفظ الإعداد");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-medium text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{description}</p>
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        role="switch"
        aria-checked={enabled}
        aria-label={title}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
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
