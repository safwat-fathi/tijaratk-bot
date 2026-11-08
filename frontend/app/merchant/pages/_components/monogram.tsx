import type { PageChannel } from "@/lib/pages";

export function Monogram({
  name,
  channel,
  size = "md",
}: {
  name: string | null;
  channel: PageChannel | string;
  size?: "sm" | "md" | "lg";
}) {
  const cleanName = (name ?? "").trim();
  const initial = cleanName ? Array.from(cleanName)[0] : "ص";
  const isIg = channel === "INSTAGRAM";

  const sizeClasses = {
    sm: "w-7 h-7 text-xs rounded-md",
    md: "w-10 h-10 text-base rounded-lg",
    lg: "w-12 h-12 text-lg rounded-xl",
  }[size];

  const platformColors = isIg
    ? "bg-[#E1306C]/12 text-[#C12258] border-[#E1306C]/25"
    : "bg-[#1877F2]/12 text-[#145DBF] border-[#1877F2]/25";

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center font-display font-semibold border ${sizeClasses} ${platformColors}`}
    >
      {initial}
    </span>
  );
}

export function PlatformBadge({ channel }: { channel: PageChannel | string }) {
  const isIg = channel === "INSTAGRAM";
  return (
    <span className="inline-flex items-center rounded-md border border-line bg-canvas px-2 py-0.5 text-xs font-display font-medium text-ink-soft">
      {isIg ? "IG" : "FB"}
    </span>
  );
}

