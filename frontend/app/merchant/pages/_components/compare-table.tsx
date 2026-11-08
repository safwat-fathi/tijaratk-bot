"use client";

import { useState } from "react";
import Link from "next/link";
import type { PageOverviewItem, StatsRange } from "@/lib/pages";
import { formatNumber, pagesCopy } from "../pages-copy";
import { Monogram, PlatformBadge } from "./monogram";
import { Sparkline } from "./sparkline";

type SortKey =
  | "name"
  | "state"
  | "conversations"
  | "handled_by_ai"
  | "handled_pct"
  | "orders"
  | "revenue_egp";

export function CompareTable({
  pages,
  range,
}: {
  pages: PageOverviewItem[];
  range: StatsRange;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("conversations");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...pages].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "name":
        return (
          dir *
          (a.account_name ?? "").localeCompare(b.account_name ?? "", "ar")
        );
      case "state":
        return dir * a.ai_state.localeCompare(b.ai_state);
      case "conversations":
        return dir * (a.summary.conversations - b.summary.conversations);
      case "handled_by_ai":
        return dir * (a.summary.handled_by_ai - b.summary.handled_by_ai);
      case "handled_pct":
        return dir * (a.summary.handled_pct - b.summary.handled_pct);
      case "orders":
        return dir * (a.summary.orders - b.summary.orders);
      case "revenue_egp":
        return dir * (a.summary.revenue - b.summary.revenue);
    }
  });

  const renderSortHeader = (key: SortKey, label: string) => {
    const active = sortKey === key;
    const ariaSort = active
      ? sortDir === "asc"
        ? "ascending"
        : "descending"
      : "none";
    return (
      <th
        scope="col"
        aria-sort={ariaSort}
        className="px-4 py-3 text-right text-xs font-medium text-ink-soft"
      >
        <button
          type="button"
          onClick={() => handleSort(key)}
          className="inline-flex min-h-[36px] items-center gap-1 font-medium text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile rounded-xs"
        >
          <span>{label}</span>
          {active && (
            <span aria-hidden="true">{sortDir === "asc" ? "↑" : "↓"}</span>
          )}
        </button>
      </th>
    );
  };

  const renderStatePill = (page: PageOverviewItem) => {
    const label = pagesCopy.stateLabel(page.ai_state, page.ai_paused_until);
    const lamp =
      page.ai_state === "on"
        ? "bg-nile"
        : page.ai_state === "paused"
          ? "bg-saffron"
          : "bg-stone";
    return (
      <span className="inline-flex items-center gap-2 text-xs font-medium text-ink">
        <span className={`h-2 w-2 rounded-full ${lamp}`} aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  };

  return (
    <div>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">مقارنة أداء الصفحات</caption>
          <thead className="border-b border-line bg-canvas/50">
            <tr>
              {renderSortHeader("name", "الصفحة")}
              {renderSortHeader("state", "حالة الرد")}
              {renderSortHeader("conversations", "المحادثات")}
              {renderSortHeader("handled_by_ai", "رد الذكاء الاصطناعي")}
              {renderSortHeader("handled_pct", "النسبة")}
              {renderSortHeader("orders", "الطلبات")}
              {renderSortHeader("revenue_egp", "الإيرادات")}
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium text-ink-soft"
              >
                الاتجاه اليومي
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((page) => {
              const displayName = page.account_name || "صفحة بدون اسم";
              return (
                <tr key={page.id} className="hover:bg-canvas/40 transition-colors">
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/merchant/pages/${page.id}?range=${range}`}
                      className="inline-flex items-center gap-2.5 font-display font-medium text-ink hover:text-nile focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile rounded-xs"
                    >
                      <Monogram
                        name={displayName}
                        channel={page.channel}
                        size="sm"
                      />
                      <span>{displayName}</span>
                      <PlatformBadge channel={page.channel} />
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">{renderStatePill(page)}</td>
                  <td className="px-4 py-3.5 font-display tabular-nums text-ink">
                    {formatNumber(page.summary.conversations)}
                  </td>
                  <td className="px-4 py-3.5 font-display tabular-nums text-ink">
                    {formatNumber(page.summary.handled_by_ai)}
                  </td>
                  <td className="px-4 py-3.5 font-display tabular-nums text-ink">
                    {page.summary.handled_pct}%
                  </td>
                  <td className="px-4 py-3.5 font-display tabular-nums text-ink">
                    {formatNumber(page.summary.orders)}
                  </td>
                  <td className="px-4 py-3.5 font-display tabular-nums text-ink">
                    {formatNumber(page.summary.revenue)} ج.م
                  </td>
                  <td className="px-4 py-3.5">
                    <Sparkline series={page.daily} width={110} height={28} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Cards */}
      <div className="md:hidden space-y-3">
        {sorted.map((page) => {
          const displayName = page.account_name || "صفحة بدون اسم";
          return (
            <div
              key={page.id}
              className="rounded-2xl border border-line bg-surface p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/merchant/pages/${page.id}?range=${range}`}
                  className="inline-flex items-center gap-2 font-display font-semibold text-ink"
                >
                  <Monogram
                    name={displayName}
                    channel={page.channel}
                    size="sm"
                  />
                  <span>{displayName}</span>
                  <PlatformBadge channel={page.channel} />
                </Link>
                {renderStatePill(page)}
              </div>

              <dl className="grid grid-cols-2 gap-2 text-xs font-display tabular-nums">
                <div>
                  <dt className="text-ink-soft">المحادثات</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {formatNumber(page.summary.conversations)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-soft">رد الذكاء الاصطناعي</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {formatNumber(page.summary.handled_by_ai)} (
                    {page.summary.handled_pct}%)
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-soft">الطلبات</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {formatNumber(page.summary.orders)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-soft">الإيرادات</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {formatNumber(page.summary.revenue)} ج.م
                  </dd>
                </div>
              </dl>

              <Sparkline series={page.daily} width={220} height={28} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
