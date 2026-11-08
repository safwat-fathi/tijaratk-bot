import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getCurrentMerchant } from "@/lib/dal";
import {
  connectPlatformAction,
  fetchConversationsAction,
  getPage,
} from "@/app/merchant/actions";
import { ConversationsClient } from "@/app/merchant/conversations/conversations-client";
import type { StatsRange } from "@/lib/pages";
import { formatCairoDate, formatNumber, pagesCopy } from "../pages-copy";
import { AiRepliesTab } from "../_components/ai-replies-tab";
import { AiSign } from "../_components/ai-sign";
import { DailyBars } from "../_components/daily-bars";
import { DisconnectDialog } from "../_components/disconnect-dialog";
import { Monogram, PlatformBadge } from "../_components/monogram";
import { PauseMenu } from "../_components/pause-menu";

type DetailTab = "performance" | "ai" | "conversations" | "connection";

function parseRange(r?: string): StatsRange {
  if (r === "today" || r === "7d" || r === "30d") return r;
  return "7d";
}

function parseTab(t?: string): DetailTab {
  if (
    t === "performance" ||
    t === "ai" ||
    t === "conversations" ||
    t === "connection"
  ) {
    return t;
  }
  return "performance";
}

function formatDelta(
  current: number,
  previous: number,
  mode: "pct" | "abs" = "pct",
): string {
  const diff = current - previous;
  if (diff === 0) return "0%";
  if (mode === "abs") {
    return diff > 0 ? `+${formatNumber(diff)}` : `${formatNumber(diff)}`;
  }
  if (previous === 0) {
    return current > 0 ? "+100%" : "0%";
  }
  const pct = Math.round((diff / previous) * 100);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

export default async function MerchantPageDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string; tab?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const range = parseRange(query.range);
  const tab = parseTab(query.tab);

  const data = await getPage(id, range).catch(() => null);
  if (!data) {
    notFound();
  }

  const page = data;
  const { summary, previous_summary, daily } = data;
  const displayName = page.account_name || "صفحة بدون اسم";
  const platformLabel = page.channel === "INSTAGRAM" ? "إنستجرام" : "فيسبوك";
  const platformSlug = page.channel === "INSTAGRAM" ? "instagram" : "facebook";

  const rangePhrase =
    range === "today"
      ? "اليوم"
      : range === "30d"
        ? "في آخر 30 يوم"
        : "في آخر 7 أيام";

  const prevRangeLabel =
    range === "today"
      ? "مقارنة بأمس"
      : range === "30d"
        ? "مقارنة بـ 30 يوم سابقة"
        : "مقارنة بـ 7 أيام سابقة";

  const conversationsData =
    tab === "conversations"
      ? await Promise.all([
          getCurrentMerchant(),
          fetchConversationsAction(undefined, page.id).catch(() => []),
        ])
      : null;

  const tabs: Array<{ key: DetailTab; label: string }> = [
    { key: "performance", label: "الأداء" },
    { key: "ai", label: "الرد الآلي" },
    { key: "conversations", label: "المحادثات" },
    { key: "connection", label: "الربط" },
  ];

  return (
    <div className="mx-auto max-w-5xl rounded-3xl bg-canvas p-4 sm:p-6 lg:p-8 text-ink space-y-6">
      {/* Header */}
      <header className="space-y-4">
        <Link
          href={`/merchant/pages?range=${range}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile rounded-xs"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          <span>{pagesCopy.title}</span>
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Monogram name={displayName} channel={page.channel} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl sm:text-2xl font-bold text-ink">
                  {displayName}
                </h1>
                <PlatformBadge channel={page.channel} />
              </div>
              <p className="text-xs text-ink-soft mt-0.5">
                {platformLabel}
                {!page.is_active && " · صفحة مفصولة"}
              </p>
            </div>
          </div>

          {page.is_active && (
            <div className="flex flex-wrap items-center gap-2.5">
              <AiSign
                pageId={page.id}
                pageName={displayName}
                aiState={page.ai_state}
                pausedUntil={page.ai_paused_until}
              />
              <PauseMenu
                pageId={page.id}
                pageName={displayName}
                aiState={page.ai_state}
              />
            </div>
          )}
        </div>

        {/* Range selector */}
        <div
          role="group"
          aria-label="الفترة الزمنية"
          className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs font-medium tabular-nums"
        >
          {(["today", "7d", "30d"] as const).map((r) => (
            <Link
              key={r}
              href={`/merchant/pages/${page.id}?tab=${tab}&range=${r}`}
              className={`inline-flex min-h-[36px] items-center rounded-md px-3 py-1.5 transition-colors ${
                range === r
                  ? "bg-ink text-white"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {pagesCopy.ranges[r]}
            </Link>
          ))}
        </div>
      </header>

      {/* Tabs navigation */}
      <nav
        aria-label="أقسام الصفحة"
        className="flex flex-wrap gap-1 border-b border-line"
      >
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <Link
              key={t.key}
              href={`/merchant/pages/${page.id}?tab=${t.key}&range=${range}`}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-[44px] items-center border-b-2 px-4 py-2.5 font-display text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile ${
                active
                  ? "border-nile text-nile"
                  : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {/* Tab Content */}
      {tab === "performance" && (
        <section className="space-y-6">
          {/* Plain headline sentence + Daily Bars */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-5">
            <p className="font-display text-base sm:text-lg text-ink tabular-nums">
              {rangePhrase} الذكاء الاصطناعي رد على{" "}
              <strong className="font-bold">
                {formatNumber(summary.handled_by_ai)}
              </strong>{" "}
              من{" "}
              <strong className="font-bold">
                {formatNumber(summary.conversations)}
              </strong>{" "}
              محادثة ({summary.handled_pct}%).{" "}
              <span className="text-ink-soft">
                {formatNumber(summary.needed_you)} احتاجت تدخلك.
              </span>
            </p>

            <DailyBars series={daily} pageName={displayName} />
          </div>

          {/* Definition list with deltas */}
          <div className="rounded-2xl border border-line bg-surface px-5 py-4">
            <div className="flex items-center justify-between border-b border-line pb-2.5 text-xs text-ink-soft">
              <span>المؤشر</span>
              <span>{prevRangeLabel}</span>
            </div>

            <dl className="divide-y divide-line font-display tabular-nums text-sm">
              <div className="flex items-center justify-between py-3.5">
                <dt className="text-ink">المحادثات</dt>
                <dd className="flex items-center gap-6">
                  <span className="font-semibold text-ink">
                    {formatNumber(summary.conversations)}
                  </span>
                  <span className="w-16 text-left text-xs text-ink-soft">
                    {formatDelta(
                      summary.conversations,
                      previous_summary.conversations,
                    )}
                  </span>
                </dd>
              </div>

              <div className="flex items-center justify-between py-3.5">
                <dt className="text-ink">رد الذكاء الاصطناعي</dt>
                <dd className="flex items-center gap-6">
                  <span className="font-semibold text-nile">
                    {formatNumber(summary.handled_by_ai)}
                  </span>
                  <span className="w-16 text-left text-xs text-ink-soft">
                    {formatDelta(
                      summary.handled_by_ai,
                      previous_summary.handled_by_ai,
                    )}
                  </span>
                </dd>
              </div>

              <div className="flex items-center justify-between py-3.5">
                <dt className="text-ink">احتاجت تدخلك</dt>
                <dd className="flex items-center gap-6">
                  <span className="font-semibold text-ink">
                    {formatNumber(summary.needed_you)}
                  </span>
                  <span className="w-16 text-left text-xs text-ink-soft">
                    {formatDelta(
                      summary.needed_you,
                      previous_summary.needed_you,
                    )}
                  </span>
                </dd>
              </div>

              <div className="flex items-center justify-between py-3.5">
                <dt className="text-ink">الطلبات</dt>
                <dd className="flex items-center gap-6">
                  <span className="font-semibold text-ink">
                    {formatNumber(summary.orders)}
                  </span>
                  <span className="w-16 text-left text-xs text-ink-soft">
                    {formatDelta(
                      summary.orders,
                      previous_summary.orders,
                      "abs",
                    )}
                  </span>
                </dd>
              </div>

              <div className="flex items-center justify-between py-3.5">
                <dt className="text-ink">الإيرادات</dt>
                <dd className="flex items-center gap-6">
                  <span className="font-semibold text-ink">
                    {formatNumber(summary.revenue)} ج.م
                  </span>
                  <span className="w-16 text-left text-xs text-ink-soft">
                    {formatDelta(
                      summary.revenue,
                      previous_summary.revenue,
                    )}
                  </span>
                </dd>
              </div>
            </dl>

            <p className="mt-3 pt-2 border-t border-line text-xs text-ink-soft">
              * تشمل الطلبات والإيرادات الطلبات المرتبطة بمحادثات هذه الصفحة فقط
              (لا تشمل الطلبات اليدوية غير المرتبطة بمحادثة).
            </p>
          </div>
        </section>
      )}

      {tab === "ai" && <AiRepliesTab page={page} />}

      {tab === "conversations" && conversationsData && (
        <section>
          <ConversationsClient
            merchantId={conversationsData[0].merchantId}
            conversations={conversationsData[1]}
            hidePageHeader
          />
        </section>
      )}

      {tab === "connection" && (
        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6 max-w-2xl space-y-5">
          <h2 className="font-display text-base font-semibold text-ink">
            تفاصيل ربط الصفحة
          </h2>

          <dl className="divide-y divide-line text-sm">
            <div className="flex items-center justify-between py-3">
              <dt className="text-ink-soft">الحالة</dt>
              <dd className="font-medium text-ink">
                {page.is_active ? "متصلة ونشطة" : "مفصولة"}
              </dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="text-ink-soft">اسم الحساب على المنصة</dt>
              <dd className="font-display font-medium text-ink">
                {displayName} ({platformLabel})
              </dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="text-ink-soft">تاريخ الربط</dt>
              <dd className="font-display tabular-nums text-ink">
                {formatCairoDate(page.created_at)}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line">
            <form action={connectPlatformAction.bind(null, platformSlug)}>
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center rounded-lg border border-line bg-canvas px-4 py-2 text-sm font-medium text-ink hover:border-nile transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile"
              >
                {pagesCopy.reconnect}
              </button>
            </form>

            {page.is_active && (
              <DisconnectDialog pageId={page.id} pageName={displayName} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
