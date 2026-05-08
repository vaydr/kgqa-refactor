"use client";

type SelectionCount = [
  string,
  { count: number; color: [number, number, number, number] | undefined },
];

interface SelectionTooltipProps {
  selectionCounts: SelectionCount[];
  isDark: boolean;
}

export function SelectionTooltip({
  selectionCounts,
  isDark,
}: SelectionTooltipProps) {
  if (selectionCounts.length === 0) return null;

  const total = selectionCounts.reduce((sum, [, { count }]) => sum + count, 0);

  return (
    <div
      className={`pointer-events-none absolute top-3 left-3 overflow-hidden rounded-md border font-mono backdrop-blur-sm ${isDark ? "border-white/[0.06] bg-black/60" : "border-black/[0.06] bg-white/70"}
      `}
    >
      {/* Header */}
      <div
        className={`border-b px-2.5 py-1 text-[9px] uppercase tracking-[0.15em] ${isDark ? "border-white/[0.04] text-white/40" : "border-black/[0.04] text-black/40"}
        `}
      >
        Selected &middot; {total}
      </div>

      {/* Category rows */}
      <div className="flex flex-col gap-px px-2.5 py-1.5">
        {selectionCounts.map(([category, { count, color }]) => {
          const colorStr = color
            ? `rgb(${color[0]}, ${color[1]}, ${color[2]})`
            : isDark
              ? "rgb(100,100,120)"
              : "rgb(160,160,175)";

          return (
            <div className="flex items-center gap-2 py-0.5" key={category}>
              <span
                className="inline-block size-[5px] shrink-0 rounded-full"
                style={{ backgroundColor: colorStr }}
              />
              <span
                className={`flex-1 truncate text-[9px] ${isDark ? "text-white/50" : "text-black/50"}`}
              >
                {category}
              </span>
              <span
                className={`text-[8px] tabular-nums ${isDark ? "text-white/30" : "text-black/30"}`}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
