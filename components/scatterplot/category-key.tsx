"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

type CategoryEntry = {
  name: string;
  count: number;
  selectedCount: number;
  color: [number, number, number, number] | null;
};

interface CategoryKeyProps {
  categories: CategoryEntry[];
  isDark: boolean;
}

export function CategoryKey({ categories, isDark }: CategoryKeyProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (categories.length === 0) return null;

  const totalSelected = categories.reduce((s, c) => s + c.selectedCount, 0);

  return (
    <div
      className={`pointer-events-auto absolute right-3 bottom-3 overflow-hidden rounded-md border font-mono backdrop-blur-sm ${isDark ? "border-white/[0.06] bg-black/60" : "border-black/[0.06] bg-white/70"}`}
      style={{ minWidth: 140 }}
    >
      <button
        className={`flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-[9px] uppercase tracking-[0.15em] transition-colors ${isDark ? "text-white/40 hover:text-white/60" : "text-black/40 hover:text-black/60"}`}
        onClick={() => setIsOpen((o) => !o)}
        type="button"
      >
        <span>
          Categories
          {totalSelected > 0 && (
            <span className={isDark ? "text-white/60" : "text-black/60"}>
              {" "}({totalSelected})
            </span>
          )}
        </span>
        <ChevronDownIcon
          className="size-3 transition-transform"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      {isOpen && (
        <div className="flex flex-col gap-px px-2.5 pb-2">
          {categories.map((cat) => {
            const colorStr = cat.color
              ? `rgb(${cat.color[0]}, ${cat.color[1]}, ${cat.color[2]})`
              : isDark
                ? "rgb(100,100,120)"
                : "rgb(160,160,175)";

            return (
              <div className="flex items-center gap-2 py-0.5" key={cat.name}>
                <span
                  className="inline-block size-[5px] shrink-0 rounded-full"
                  style={{ backgroundColor: colorStr }}
                />
                <span
                  className={`flex-1 truncate text-[9px] ${isDark ? "text-white/50" : "text-black/50"}`}
                >
                  {cat.name}
                </span>
                <span
                  className={`text-[8px] tabular-nums ${isDark ? "text-white/25" : "text-black/25"}`}
                >
                  {cat.count}
                  {cat.selectedCount > 0 && (
                    <span className={isDark ? "text-white/50" : "text-black/50"}>
                      {" "}({cat.selectedCount})
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
