"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { disconnectPage } from "@/app/merchant/actions";
import { pagesCopy } from "../pages-copy";

export function DisconnectDialog({
  pageId,
  pageName,
}: {
  pageId: string;
  pageName: string | null;
}) {
  const displayName = pageName || "الصفحة";
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  const handleDisconnect = () => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await disconnectPage(pageId);
        setOpen(false);
        router.push(
          `/merchant/pages?disconnected=${encodeURIComponent(displayName)}`,
        );
      } catch {
        setErrorMsg("تعذر فصل الصفحة. حاول مرة أخرى.");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center rounded-lg border border-poppy/40 bg-surface px-4 py-2 text-sm font-medium text-poppy hover:bg-poppy/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-poppy"
      >
        {pagesCopy.disconnectButton(displayName)}
      </button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={pagesCopy.disconnectButton(displayName)}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink leading-relaxed">
            {pagesCopy.disconnectModalBody(displayName)}
          </p>

          {errorMsg && (
            <p role="alert" className="text-xs text-poppy font-medium">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-canvas transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleDisconnect}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-poppy px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-poppy disabled:opacity-60"
            >
              {isPending
                ? "جاري الفصل..."
                : pagesCopy.disconnectButton(displayName)}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

