import Link from "next/link";
import { connectPlatformAction, getPages } from "@/app/merchant/actions";
import type { StatsRange } from "@/lib/pages";
import { formatNumber, pagesCopy } from "./pages-copy";
import { AddPageSheet } from "./_components/add-page-sheet";
import { CompareTable } from "./_components/compare-table";
import { MasterOffBanner } from "./_components/master-off-banner";
import { Monogram, PlatformBadge } from "./_components/monogram";
import { PageCard } from "./_components/page-card";

function parseRange(r?: string): StatsRange {
  if (r === "today" || r === "7d" || r === "30d") return r;
  return "7d";
}

export default async function MerchantPagesOverview({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    view?: string;
    connected?: string;
    disconnected?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const range = parseRange(params.range);
  const view = params.view === "compare" ? "compare" : "cards";

  const data = await getPages(range);
  const activePages = data.pages;
  const disconnectedPages = data.disconnected;
  const answeringCount = activePages.filter((p) => p.ai_state === "on").length;

  const pageNameById = new Map<string, string>();
  for (const p of [...activePages, ...disconnectedPages]) {
    pageNameById.set(p.id, p.account_name || "صفحة");
  }

  const nonZeroShares = data.usage.by_page.filter((s) => s.used > 0);
  const overQuota = data.usage.used >= data.usage.limit;

  return (
    <div className="mx-auto max-w-6xl rounded-3xl bg-canvas p-4 sm:p-6 lg:p-8 text-ink space-y-6">
      {/* Return / Action Notices */}
      {params.connected && (
        <div
          role="status"
          className="rounded-2xl border border-nile/30 bg-nile-wash px-4 py-3 text-sm font-medium text-ink"
        >
          {pagesCopy.toastConnected(params.connected)}
        </div>
      )}
      {params.disconnected && (
        <div
          role="status"
          className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-medium text-ink"
        >
          {pagesCopy.disconnectToast(params.disconnected)}
        </div>
      )}
      {params.error && (
        <div
          role="alert"
          className="rounded-2xl border border-poppy/30 bg-surface px-4 py-3 text-sm font-medium text-poppy"
        >
          {pagesCopy.connectErrors[params.error] ??
            pagesCopy.connectErrors.connect_failed}
        </div>
      )}

      {/* Header */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">
              {pagesCopy.title}
            </h1>
            {activePages.length > 0 && (
              <p className="mt-1 font-display text-sm text-ink-soft tabular-nums">
                {activePages.length} صفحات · الذكاء الاصطناعي بيرد على{" "}
                {answeringCount}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View toggle: Cards | Compare */}
            {activePages.length > 0 && (
              <div
                role="group"
                aria-label="طريقة العرض"
                className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs font-medium"
              >
                <Link
                  href={`/merchant/pages?range=${range}&view=cards`}
                  className={`inline-flex min-h-[36px] items-center rounded-md px-3 py-1.5 transition-colors ${
                    view === "cards"
                      ? "bg-nile text-white"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {pagesCopy.viewCards}
                </Link>
                <Link
                  href={`/merchant/pages?range=${range}&view=compare`}
                  className={`inline-flex min-h-[36px] items-center rounded-md px-3 py-1.5 transition-colors ${
                    view === "compare"
                      ? "bg-nile text-white"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {pagesCopy.viewCompare}
                </Link>
              </div>
            )}

            {/* Range chips */}
            {activePages.length > 0 && (
              <div
                role="group"
                aria-label="الفترة الزمنية"
                className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs font-medium tabular-nums"
              >
                {(["today", "7d", "30d"] as const).map((r) => (
                  <Link
                    key={r}
                    href={`/merchant/pages?range=${r}&view=${view}`}
                    className={`inline-flex min-h-[36px] items-center rounded-md px-2.5 py-1.5 transition-colors ${
                      range === r
                        ? "bg-ink text-white"
                        : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {pagesCopy.ranges[r]}
                  </Link>
                ))}
              </div>
            )}

            <AddPageSheet activeCount={activePages.length} variant="button" />
          </div>
        </div>

        {/* Shared Monthly Quota Line */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface/80 px-4 py-2.5 text-xs text-ink-soft font-display tabular-nums">
          <div>
            <span>
              هذا الشهر:{" "}
              <strong className="font-semibold text-ink">
                {formatNumber(data.usage.used)}
              </strong>{" "}
              من{" "}
              <strong className="font-semibold text-ink">
                {formatNumber(data.usage.limit)}
              </strong>{" "}
              محادثة ذكاء اصطناعي مستخدمة
            </span>
            {nonZeroShares.length > 0 && (
              <span className="mr-1.5 text-ink-soft">
                (
                {nonZeroShares
                  .map(
                    (s) =>
                      `${pageNameById.get(s.id) ?? "صفحة"} ${formatNumber(s.used)}`,
                  )
                  .join(" · ")}
                )
              </span>
            )}
            {overQuota && (
              <span className="mr-2 font-semibold text-saffron-ink">
                — {pagesCopy.stateLabel("over_quota", null)}
              </span>
            )}
          </div>
          <Link
            href="/merchant/settings"
            className="font-medium text-nile hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile rounded-xs"
          >
            الإعدادات والباقة
          </Link>
        </div>
      </header>

      {/* Master Off Banner */}
      {!data.merchant_ai_enabled && <MasterOffBanner />}

      {/* Main Content: Empty state, Cards, or Compare */}
      {activePages.length === 0 ? (
        <section className="rounded-2xl border border-line bg-surface p-8 text-center space-y-4">
          <p className="font-display text-base font-medium text-ink max-w-md mx-auto">
            {pagesCopy.emptyState}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <form action={connectPlatformAction.bind(null, "facebook")}>
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-nile px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile"
              >
                {pagesCopy.connectFacebook}
              </button>
            </form>
            <form action={connectPlatformAction.bind(null, "instagram")}>
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-canvas transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile"
              >
                {pagesCopy.connectInstagram}
              </button>
            </form>
          </div>
        </section>
      ) : view === "compare" ? (
        <CompareTable pages={activePages} range={range} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activePages.map((page) => (
            <PageCard
              key={page.id}
              page={page}
              range={range}
              highlighted={
                Boolean(params.connected) &&
                page.account_name === params.connected
              }
            />
          ))}
          <AddPageSheet activeCount={activePages.length} variant="card" />
        </div>
      )}

      {/* Disconnected pages collapsible list */}
      {disconnectedPages.length > 0 && (
        <details className="rounded-2xl border border-line bg-surface px-4 py-3">
          <summary className="cursor-pointer select-none font-display text-sm font-medium text-ink-soft hover:text-ink py-1">
            {pagesCopy.disconnectedTitle(disconnectedPages.length)}
          </summary>
          <ul className="mt-3 divide-y divide-line">
            {disconnectedPages.map((d) => {
              const name = d.account_name || "صفحة بدون اسم";
              const platform =
                d.channel === "INSTAGRAM" ? "instagram" : "facebook";
              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <Monogram name={name} channel={d.channel} size="sm" />
                    <Link
                      href={`/merchant/pages/${d.id}`}
                      className="font-display text-sm font-medium text-ink hover:underline"
                    >
                      {name}
                    </Link>
                    <PlatformBadge channel={d.channel} />
                  </div>
                  <form action={connectPlatformAction.bind(null, platform)}>
                    <button
                      type="submit"
                      className="inline-flex min-h-[40px] items-center rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-medium text-ink hover:border-nile transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile"
                    >
                      {pagesCopy.reconnect}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}

