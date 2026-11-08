"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import type { PageAiState } from "@/lib/pages";
import { setPageAi } from "@/app/merchant/actions";
import { pagesCopy } from "../pages-copy";

export function PauseMenu({
  pageId,
  pageName,
  aiState,
  disabled = false,
}: {
  pageId: string;
  pageName: string | null;
  aiState: PageAiState;
  disabled?: boolean;
}) {
  const displayName = pageName || "الصفحة";
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isLocked =
    disabled || aiState === "master_off" || aiState === "over_quota";

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleAction = (patch: {
    ai_enabled?: boolean;
    pause_hours?: number | null;
  }) => {
    setOpen(false);
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await setPageAi(pageId, patch);
      } catch {
        setErrorMsg(pagesCopy.toggleError(displayName));
      }
    });
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        disabled={isLocked || isPending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`خيارات الإيقاف المؤقت لصفحة ${displayName}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-canvas transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>
          {aiState === "paused" || aiState === "off"
            ? pagesCopy.pauseMenu.resumeNow
            : pagesCopy.pauseButton}
        </span>
        <ChevronDown className="h-4 w-4 text-ink-soft" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`مدة الإيقاف لصفحة ${displayName}`}
          className="absolute left-0 z-20 mt-1.5 w-48 rounded-lg border border-line bg-surface py-1 shadow-lg"
        >
          {(aiState === "paused" || aiState === "off") && (
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                handleAction({ ai_enabled: true, pause_hours: null })
              }
              className="flex min-h-[44px] w-full items-center px-3.5 py-2 text-right text-sm font-medium text-nile hover:bg-nile-wash focus-visible:outline-none focus-visible:bg-nile-wash"
            >
              {pagesCopy.pauseMenu.resumeNow}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleAction({ ai_enabled: true, pause_hours: 1 })}
            className="flex min-h-[44px] w-full items-center px-3.5 py-2 text-right text-sm text-ink hover:bg-canvas focus-visible:outline-none focus-visible:bg-canvas tabular-nums"
          >
            {pagesCopy.pauseMenu.oneHour}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleAction({ ai_enabled: true, pause_hours: 8 })}
            className="flex min-h-[44px] w-full items-center px-3.5 py-2 text-right text-sm text-ink hover:bg-canvas focus-visible:outline-none focus-visible:bg-canvas tabular-nums"
          >
            {pagesCopy.pauseMenu.eightHours}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleAction({ ai_enabled: true, pause_hours: 24 })}
            className="flex min-h-[44px] w-full items-center px-3.5 py-2 text-right text-sm text-ink hover:bg-canvas focus-visible:outline-none focus-visible:bg-canvas tabular-nums"
          >
            {pagesCopy.pauseMenu.twentyFourHours}
          </button>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            onClick={() => handleAction({ ai_enabled: false })}
            className="flex min-h-[44px] w-full items-center px-3.5 py-2 text-right text-sm text-poppy hover:bg-canvas focus-visible:outline-none focus-visible:bg-canvas"
          >
            {pagesCopy.pauseMenu.turnOff}
          </button>
        </div>
      )}

      {errorMsg && (
        <p role="alert" className="mt-1 text-xs text-poppy">
          {errorMsg}
        </p>
      )}
    </div>
  );
}

