import type { PageDailyPoint } from "@/lib/pages";
import { formatDayLabel } from "../pages-copy";

export function DailyBars({
  series,
  pageName,
}: {
  series: PageDailyPoint[];
  pageName: string;
}) {
  const points = series.length > 0 ? series : [];
  const maxVal = Math.max(
    1,
    ...points.map((p) => Math.max(p.conversations, p.handled_by_ai)),
  );

  const svgWidth = 560;
  const svgHeight = 140;
  const chartBottom = 112;
  const chartTop = 12;
  const chartHeight = chartBottom - chartTop;
  const count = Math.max(points.length, 1);
  const slotWidth = svgWidth / count;
  const barWidth = Math.min(14, Math.max(4, slotWidth * 0.28));

  return (
    <div>
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-36"
          role="img"
          aria-label={`الرسم البياني اليومي لصفحة ${pageName}`}
        >
          <line
            x1={0}
            y1={chartBottom}
            x2={svgWidth}
            y2={chartBottom}
            stroke="var(--color-line)"
            strokeWidth="1"
          />
          {points.map((pt, idx) => {
            const centerX = idx * slotWidth + slotWidth / 2;
            const totalH = Math.max(
              pt.conversations > 0 ? 3 : 0,
              (pt.conversations / maxVal) * chartHeight,
            );
            const aiH = Math.max(
              pt.handled_by_ai > 0 ? 3 : 0,
              (pt.handled_by_ai / maxVal) * chartHeight,
            );
            const showLabel =
              points.length <= 10 || idx % Math.ceil(points.length / 7) === 0 || idx === points.length - 1;

            return (
              <g key={pt.date}>
                {/* Total conversations bar (line grey) */}
                <rect
                  x={centerX - barWidth - 1}
                  y={chartBottom - totalH}
                  width={barWidth}
                  height={totalH}
                  rx={2}
                  fill="var(--color-line)"
                />
                {/* Handled by AI bar (nile green) */}
                <rect
                  x={centerX + 1}
                  y={chartBottom - aiH}
                  width={barWidth}
                  height={aiH}
                  rx={2}
                  fill="var(--color-nile)"
                />
                {showLabel && (
                  <text
                    x={centerX}
                    y={svgHeight - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--color-ink-soft)"
                  >
                    {formatDayLabel(pt.date)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 flex items-center gap-4 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-nile" aria-hidden="true" />
          رد الذكاء الاصطناعي
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-line" aria-hidden="true" />
          كل المحادثات
        </span>
      </div>

      {/* Accessible text table for screen readers */}
      <table className="sr-only">
        <caption>الأداء اليومي لصفحة {pageName}</caption>
        <thead>
          <tr>
            <th scope="col">اليوم</th>
            <th scope="col">كل المحادثات</th>
            <th scope="col">رد الذكاء الاصطناعي</th>
          </tr>
        </thead>
        <tbody>
          {points.map((pt) => (
            <tr key={pt.date}>
              <td>{pt.date}</td>
              <td>{pt.conversations}</td>
              <td>{pt.handled_by_ai}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
