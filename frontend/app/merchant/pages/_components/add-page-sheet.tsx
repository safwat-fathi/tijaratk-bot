"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { connectPlatformAction } from "@/app/merchant/actions";
import { pagesCopy } from "../pages-copy";

export function AddPageSheet({
  activeCount,
  variant = "button",
}: {
  activeCount: number;
  variant?: "button" | "card";
}) {
  const [open, setOpen] = useState(false);

  if (activeCount >= 10) {
    return (
      <span className="inline-flex items-center rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-soft">
        {pagesCopy.capMessage}
      </span>
    );
  }

  return (
    <>
      {variant === "card" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-surface/60 p-6 text-center hover:border-nile hover:bg-nile-wash/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-nile-wash text-nile">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-display text-sm font-semibold text-ink">
            {pagesCopy.addPage}
          </span>
          <span className="text-xs text-ink-soft">فيسبوك · إنستجرام</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-nile px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile focus-visible:ring-offset-2"
        >
          <span>{pagesCopy.addPage}</span>
        </button>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="إضافة صفحة جديدة"
        maxWidth="sm"
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">
            اختر المنصة التي تريد ربطها ليبدأ الذكاء الاصطناعي في الرد على رسائل العملاء.
          </p>

          <form action={connectPlatformAction.bind(null, "facebook")}>
            <button
              type="submit"
              className="flex min-h-[48px] w-full items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-right font-display text-sm font-semibold text-ink hover:border-nile hover:bg-nile-wash/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile"
            >
              <span>صفحة فيسبوك (Facebook)</span>
              <span className="rounded-md bg-[#1877F2]/12 px-2 py-0.5 text-xs text-[#145DBF]">
                FB
              </span>
            </button>
          </form>

          <form action={connectPlatformAction.bind(null, "instagram")}>
            <button
              type="submit"
              className="flex min-h-[48px] w-full items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-right font-display text-sm font-semibold text-ink hover:border-nile hover:bg-nile-wash/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile"
            >
              <span>حساب إنستجرام (Instagram)</span>
              <span className="rounded-md bg-[#E1306C]/12 px-2 py-0.5 text-xs text-[#C12258]">
                IG
              </span>
            </button>
          </form>
        </div>
      </Modal>
    </>
  );
}

