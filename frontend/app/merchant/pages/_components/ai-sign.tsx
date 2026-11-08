"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { PageAiState } from "@/lib/pages";
import { setPageAi } from "@/app/merchant/actions";
import { pagesCopy } from "../pages-copy";

export function AiSign({
  pageId,
  pageName,
  aiState,
  pausedUntil,
  disabled = false,
}: {
  pageId: string;
  pageName: string | null;
  aiState: PageAiState;
  pausedUntil: string | null;
  disabled?: boolean;
}) {
  const displayName = pageName || "الصفحة";
  const [isPending, startTransition] = useTransition();
  const [optimisticState, setOptimisticState] = useOptimistic<PageAiState, PageAiState>(
    aiState,
    (_current, next) => next,
  );
  const [toast, setToast] = useState<{
    message: string;
    canUndo: boolean;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");

  const isLocked =
    disabled ||
    optimisticState === "master_off" ||
    optimisticState === "over_quota";
  const isOn = optimisticState === "on";

  const handleToggle = () => {
    if (isLocked) return;
    const nextEnabled = optimisticState !== "on";
    const targetState: PageAiState = nextEnabled ? "on" : "off";
    setErrorMsg(null);

    startTransition(async () => {
      setOptimisticState(targetState);
      try {
        await setPageAi(pageId, {
          ai_enabled: nextEnabled,
          pause_hours: nextEnabled ? null : undefined,
        });
        const msg = nextEnabled
          ? pagesCopy.toastTurnOn(displayName)
          : pagesCopy.toastTurnOff(displayName);
        setLiveAnnouncement(msg);
        setToast({ message: msg, canUndo: !nextEnabled });
      } catch {
        setErrorMsg(pagesCopy.toggleError(displayName));
        setLiveAnnouncement(pagesCopy.toggleError(displayName));
      }
    });
  };

  const handleUndo = () => {
    setToast(null);
    setErrorMsg(null);
    startTransition(async () => {
      setOptimisticState("on");
      try {
        await setPageAi(pageId, { ai_enabled: true, pause_hours: null });
        setLiveAnnouncement(pagesCopy.toastTurnOn(displayName));
      } catch {
        setErrorMsg(pagesCopy.toggleError(displayName));
      }
    });
  };

  const pillClasses =
    optimisticState === "on"
      ? "bg-nile-wash text-ink border-nile/30"
      : optimisticState === "paused"
        ? "bg-saffron/15 text-saffron-ink border-saffron/35"
        : "bg-canvas text-ink-soft border-line";

  const lampClasses =
    optimisticState === "on"
      ? "bg-nile shadow-[0_0_8px_var(--color-nile)]"
      : optimisticState === "paused"
        ? "bg-saffron"
        : "bg-stone";

  const label = pagesCopy.stateLabel(
    optimisticState,
    optimisticState === "paused" ? pausedUntil : null,
  );

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={`الرد الآلي على ${displayName}: ${label}`}
        disabled={isLocked || isPending}
        onClick={handleToggle}
        className={`inline-flex min-h-[44px] items-center gap-2.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-75 ${pillClasses}`}
      >
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 shrink-0 rounded-full transition-all duration-150 motion-reduce:transition-none ${lampClasses}`}
        />
        <span>{label}</span>
      </button>

      <div aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </div>

      {toast && (
        <div
          role="status"
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink shadow-xs"
        >
          <span>{toast.message}</span>
          {toast.canUndo && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={handleUndo}
                className="font-semibold text-nile underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile rounded-xs"
              >
                {pagesCopy.toastUndo}
              </button>
            </>
          )}
          <button
            type="button"
            aria-label="إغلاق الإشعار"
            onClick={() => setToast(null)}
            className="text-ink-soft hover:text-ink px-1"
          >
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <p role="alert" className="text-xs text-poppy font-medium">
          {errorMsg}
        </p>
      )}
    </div>
  );
}

