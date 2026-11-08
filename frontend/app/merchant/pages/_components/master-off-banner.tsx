"use client";

import { useTransition } from "react";
import { updateAiEnabledAction } from "@/app/merchant/actions";
import { pagesCopy } from "../pages-copy";

export function MasterOffBanner() {
  const [isPending, startTransition] = useTransition();

  const handleTurnOn = () => {
    startTransition(async () => {
      await updateAiEnabledAction(true);
    });
  };

  return (
    <div
      role="region"
      aria-label="تنبيه إيقاف الذكاء الاصطناعي"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink"
    >
      <div className="flex items-center gap-2.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full bg-stone"
          aria-hidden="true"
        />
        <span>{pagesCopy.masterOffBanner}</span>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={handleTurnOn}
        className="inline-flex min-h-[44px] items-center rounded-lg bg-nile px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {isPending ? "جاري التشغيل..." : pagesCopy.masterOffTurnOn}
      </button>
    </div>
  );
}

