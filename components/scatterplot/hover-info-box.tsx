"use client";

import type { ScatterPoint } from "./types";

interface HoverInfoBoxProps {
  point: ScatterPoint | null;
  isDark: boolean;
}

export function HoverInfoBox({ point, isDark }: HoverInfoBoxProps) {
  if (!point) return null;

  const colorStr = point.color
    ? `rgb(${point.color[0]}, ${point.color[1]}, ${point.color[2]})`
    : isDark
      ? "rgb(200,200,210)"
      : "rgb(40,40,50)";

  return (
    <div
      className={`pointer-events-none absolute top-3 right-3 max-w-[200px] overflow-hidden rounded-md border font-mono backdrop-blur-sm ${isDark ? "border-white/[0.06] bg-black/60" : "border-black/[0.06] bg-white/70"}
      `}
    >
      {/* Category label */}
      {point.metadata?.category && (
        <div
          className={`border-b px-2.5 py-1 text-[8px] uppercase tracking-[0.15em] ${isDark ? "border-white/[0.04]" : "border-black/[0.04]"}
          `}
          style={{ color: colorStr, opacity: 0.6 }}
        >
          {point.metadata.category}
        </div>
      )}

      <div className="px-2.5 py-1.5">
        {/* Title */}
        <div
          className="font-medium text-[10px] leading-tight"
          style={{ color: colorStr }}
        >
          {point.metadata?.title || "Untitled"}
        </div>

        {/* Summary */}
        {point.metadata?.summary && (
          <div
            className={`mt-1 text-[9px] leading-tight ${isDark ? "text-white/30" : "text-black/35"}`}
            style={{
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {point.metadata.summary}
          </div>
        )}
      </div>
    </div>
  );
}
