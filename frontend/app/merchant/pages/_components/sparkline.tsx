import type { PageDailyPoint } from "@/lib/pages";

export function Sparkline({
  series,
  width = 160,
  height = 36,
  className = "",
}: {
  series: PageDailyPoint[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const points = series.length > 0 ? series : [{ date: "", conversations: 0, handled_by_ai: 0 }];
  const maxVal = Math.max(
    1,
    ...points.map((p) => Math.max(p.conversations, p.handled_by_ai)),
  );
  const padX = 3;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const toPolyline = (key: "conversations" | "handled_by_ai") => {
    if (points.length === 1) {
      const y = padY + innerH - (points[0][key] / maxVal) * innerH;
      return `${padX},${y.toFixed(1)} ${padX + innerW},${y.toFixed(1)}`;
    }
    return points
      .map((pt, i) => {
        const x = padX + (i / (points.length - 1)) * innerW;
        const y = padY + innerH - (pt[key] / maxVal) * innerH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      className={`overflow-visible ${className}`}
    >
      <polyline
        fill="none"
        stroke="var(--color-line)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={toPolyline("conversations")}
      />
      <polyline
        fill="none"
        stroke="var(--color-nile)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={toPolyline("handled_by_ai")}
      />
    </svg>
  );
}
