"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { PageInfo } from "@/lib/pages";
import { setPageAi } from "@/app/merchant/actions";
import { formatCairoTime, pagesCopy } from "../pages-copy";

export function AiRepliesTab({ page }: { page: PageInfo }) {
  const displayName = page.account_name || "الصفحة";
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(page.ai_instructions ?? "");
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isMasterOff = page.ai_state === "master_off";
  const isOverQuota = page.ai_state === "over_quota";
  const isLocked = isMasterOff || isOverQuota || !page.is_active;

  const activeSegment: "on" | "paused" | "off" =
    page.ai_state === "paused"
      ? "paused"
      : page.ai_enabled
        ? "on"
        : "off";

  const handleStateChange = (patch: {
    ai_enabled?: boolean;
    pause_hours?: number | null;
  }) => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await setPageAi(page.id, patch);
      } catch {
        setErrorMsg(pagesCopy.toggleError(displayName));
      }
    });
  };

  const handleSaveNotes = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedNotice(false);
    startTransition(async () => {
      try {
        const trimmed = notes.trim();
        await setPageAi(page.id, {
          ai_instructions: trimmed.length > 0 ? trimmed.slice(0, 500) : null,
        });
        setSavedNotice(true);
      } catch {
        setErrorMsg("تعذر حفظ الملاحظات. حاول مرة أخرى.");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Master off or Over quota notice */}
      {isMasterOff && (
        <div className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink">
          الذكاء الاصطناعي متوقف على كل الصفحات. يمكنك تشغيله من{" "}
          <Link
            href="/merchant/settings"
            className="font-semibold text-nile underline underline-offset-2"
          >
            الإعدادات
          </Link>
          .
        </div>
      )}
      {isOverQuota && (
        <div className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink">
          خلّصت ردود الشهر للباقة الحالية. راجع{" "}
          <Link
            href="/merchant/settings"
            className="font-semibold text-nile underline underline-offset-2"
          >
            الإعدادات والاستهلاك
          </Link>
          .
        </div>
      )}

      {/* 1. Three-way segmented state control */}
      <section className="rounded-2xl border border-line bg-surface p-5 space-y-4">
        <h3 className="font-display text-base font-semibold text-ink">
          حالة الرد الآلي على «{displayName}»
        </h3>

        <div
          role="group"
          aria-label="حالة الرد الآلي"
          className="inline-flex flex-wrap rounded-xl border border-line bg-canvas p-1 gap-1"
        >
          <button
            type="button"
            disabled={isLocked || isPending}
            aria-pressed={activeSegment === "on"}
            onClick={() =>
              handleStateChange({ ai_enabled: true, pause_hours: null })
            }
            className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile disabled:opacity-60 ${
              activeSegment === "on"
                ? "bg-nile text-white"
                : "text-ink hover:bg-surface"
            }`}
          >
            بيرد دلوقتي
          </button>

          <button
            type="button"
            disabled={isLocked || isPending}
            aria-pressed={activeSegment === "paused"}
            onClick={() =>
              handleStateChange({ ai_enabled: true, pause_hours: 1 })
            }
            className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile disabled:opacity-60 ${
              activeSegment === "paused"
                ? "bg-saffron/25 text-saffron-ink font-semibold"
                : "text-ink hover:bg-surface"
            }`}
          >
            واقف مؤقتًا
          </button>

          <button
            type="button"
            disabled={isLocked || isPending}
            aria-pressed={activeSegment === "off"}
            onClick={() => handleStateChange({ ai_enabled: false })}
            className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile disabled:opacity-60 ${
              activeSegment === "off"
                ? "bg-ink text-white"
                : "text-ink hover:bg-surface"
            }`}
          >
            متوقف
          </button>
        </div>

        {/* Duration picker when paused */}
        {activeSegment === "paused" && (
          <div className="space-y-2 pt-1">
            {page.ai_paused_until && (
              <p className="text-sm text-saffron-ink font-medium tabular-nums">
                يرجع يرد الساعة {formatCairoTime(page.ai_paused_until)}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {[1, 8, 24].map((hrs) => (
                <button
                  key={hrs}
                  type="button"
                  disabled={isLocked || isPending}
                  onClick={() =>
                    handleStateChange({ ai_enabled: true, pause_hours: hrs })
                  }
                  className="inline-flex min-h-[44px] items-center rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-medium text-ink hover:border-nile tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile"
                >
                  {hrs === 1
                    ? pagesCopy.pauseMenu.oneHour
                    : hrs === 8
                      ? pagesCopy.pauseMenu.eightHours
                      : pagesCopy.pauseMenu.twentyFourHours}
                </button>
              ))}
            </div>
          </div>
        )}

        {errorMsg && (
          <p role="alert" className="text-xs text-poppy font-medium">
            {errorMsg}
          </p>
        )}
      </section>

      {/* 2. Shared catalog & policies note */}
      <section className="rounded-2xl border border-line bg-surface p-5 text-sm text-ink-soft flex flex-wrap items-center justify-between gap-3">
        <span>{pagesCopy.sharedCatalogNote}</span>
        <div className="inline-flex items-center gap-3 font-medium text-nile">
          <Link
            href="/merchant/products"
            className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile rounded-xs"
          >
            المنتجات
          </Link>
          <span aria-hidden="true">·</span>
          <Link
            href="/merchant/policies"
            className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile rounded-xs"
          >
            السياسات
          </Link>
        </div>
      </section>

      {/* 3. Phase 4: Page instructions */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <form onSubmit={handleSaveNotes} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="page-ai-instructions"
              className="font-display text-base font-semibold text-ink"
            >
              {pagesCopy.pageNotesLabel}
            </label>
            <span className="text-xs text-ink-soft font-display tabular-nums">
              {notes.length} / 500
            </span>
          </div>

          <p id="page-ai-instructions-help" className="text-xs text-ink-soft">
            {pagesCopy.pageNotesHelper}
          </p>

          <textarea
            id="page-ai-instructions"
            aria-describedby="page-ai-instructions-help"
            rows={4}
            maxLength={500}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value.slice(0, 500));
              setSavedNotice(false);
            }}
            placeholder="مثال: هذه الصفحة مخصصة لطلبات الجملة فقط، خاطب العميل بصيغة رسمية."
            className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile"
          />

          <div className="flex items-center justify-between gap-3">
            <div>
              {savedNotice && (
                <span
                  role="status"
                  className="text-xs font-medium text-nile"
                >
                  {pagesCopy.savedNotes}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-nile px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile disabled:opacity-60"
            >
              {isPending ? "جاري الحفظ..." : pagesCopy.saveNotes}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

