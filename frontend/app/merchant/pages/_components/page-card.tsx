import Link from "next/link";
import type { PageOverviewItem, StatsRange } from "@/lib/pages";
import { formatNumber, pagesCopy } from "../pages-copy";
import { AiSign } from "./ai-sign";
import { Monogram, PlatformBadge } from "./monogram";
import { PauseMenu } from "./pause-menu";
import { Sparkline } from "./sparkline";

export function PageCard({
  page,
  range,
  highlighted = false,
}: {
  page: PageOverviewItem;
  range: StatsRange;
  highlighted?: boolean;
}) {
  const displayName = page.account_name || "صفحة بدون اسم";
  const { conversations, handled_by_ai, handled_pct, orders, revenue } =
    page.summary;

  return (
    <article
      className={`flex flex-col justify-between rounded-2xl border bg-surface p-5 transition-colors ${
        highlighted
          ? "border-nile ring-2 ring-nile/25"
          : "border-line"
      }`}
    >
      <div className="space-y-4">
        {/* Header: Monogram, Name, Platform Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Monogram name={displayName} channel={page.channel} size="md" />
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-semibold text-ink">
                <Link
                  href={`/merchant/pages/${page.id}?range=${range}`}
                  className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile rounded-xs"
                >
                  {displayName}
                </Link>
              </h2>
            </div>
          </div>
          <PlatformBadge channel={page.channel} />
        </div>

        {/* Open/Closed AI Sign */}
        <div>
          <AiSign
            pageId={page.id}
            pageName={displayName}
            aiState={page.ai_state}
            pausedUntil={page.ai_paused_until}
          />
        </div>

        {/* Plain headline sentence + sparkline */}
        <div className="pt-1 space-y-2.5">
          <p className="font-display text-sm text-ink tabular-nums">
            {conversations === 0 ? (
              <span className="text-ink-soft">لا توجد محادثات في هذه الفترة</span>
            ) : (
              <>
                الذكاء الاصطناعي رد على{" "}
                <strong className="font-semibold">{formatNumber(handled_by_ai)}</strong>{" "}
                من <strong className="font-semibold">{formatNumber(conversations)}</strong>{" "}
                محادثة ({handled_pct}%)
              </>
            )}
          </p>

          <Sparkline
            series={page.daily}
            width={220}
            height={36}
            className="w-full max-w-[240px]"
          />

          <p className="text-xs text-ink-soft font-display tabular-nums">
            {formatNumber(orders)} طلب · {formatNumber(revenue)} ج.م
          </p>
        </div>
      </div>

      {/* Footer actions */}
      <div className="mt-5 flex items-center justify-between gap-2 pt-3 border-t border-line">
        <Link
          href={`/merchant/pages/${page.id}?range=${range}`}
          className="inline-flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm font-medium text-nile hover:bg-nile-wash transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile"
        >
          {pagesCopy.openPage}
        </Link>
        <PauseMenu
          pageId={page.id}
          pageName={displayName}
          aiState={page.ai_state}
        />
      </div>
    </article>
  );
}
