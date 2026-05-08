"use client";

import { BoxSelectIcon, Moon, Sun, XIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { transformCategory } from "@/lib/geometry";
import { invertMatrix2x2, type Matrix2x2 } from "@/lib/matrix";
import { CanvasCore } from "./scatterplot/canvas-core";
import { CategoryKey } from "./scatterplot/category-key";
import { HoverInfoBox } from "./scatterplot/hover-info-box";
import { MatrixEditorPanel } from "./scatterplot/matrix-editor-panel";
import { type ScatterPoint, useScatterplot } from "./scatterplot-provider";
import { LimelightNav } from "./ui/limelight-nav";

export function ScatterplotCanvasInner() {
  const {
    state,
    setPoints,
    setHoveredPoint,
    togglePoint,
    clickPoint,
    selectPoint,
    clearSelection,
  } = useScatterplot();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [lastHoveredPoint, setLastHoveredPoint] = useState<ScatterPoint | null>(
    null
  );
  const [selectMode, setSelectMode] = useState(false);

  const [basisMatrix, setBasisMatrix] = useState<Matrix2x2>([
    [1, 0],
    [0, 1],
  ]);
  const inverseMatrix = useMemo(
    () => invertMatrix2x2(basisMatrix),
    [basisMatrix]
  );

  useEffect(() => {
    if (state.points.length === 0) {
      fetch("/kg-data.json")
        .then((res) => (res.ok ? res.json() : []))
        .then((data: ScatterPoint[]) => {
          let points = data;
          points = transformCategory(points, "Natural Sciences", 1, 0, 1, 0);
          setPoints(points);
        })
        .catch(() => console.warn("Knowledge graph data not found."));
    }
  }, [state.points.length, setPoints]);

  const categoryEntries = useMemo(() => {
    const counts = new Map<
      string,
      { count: number; selectedCount: number; color: [number, number, number, number] | null }
    >();
    for (const point of state.points) {
      const cat = point.metadata?.category;
      if (!cat) continue;
      const existing = counts.get(cat);
      if (existing) {
        existing.count++;
      } else {
        counts.set(cat, { count: 1, selectedCount: 0, color: point.color || null });
      }
    }
    for (const point of state.selectedPoints) {
      const cat = point.metadata?.category || "Unknown";
      const existing = counts.get(cat);
      if (existing) {
        existing.selectedCount++;
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, { count, selectedCount, color }]) => ({ name, count, selectedCount, color }));
  }, [state.points, state.selectedPoints]);

  return (
    <>
      <CanvasCore
        basisMatrix={basisMatrix}
        clearSelection={clearSelection}
        clickPoint={clickPoint}
        hoveredPoint={state.hoveredPoint}
        inverseMatrix={inverseMatrix}
        isDark={isDark}
        onLastHoveredPointChange={setLastHoveredPoint}
        points={state.points}
        selectMode={selectMode}
        selectedPoints={state.selectedPoints}
        selectPoint={selectPoint}
        setHoveredPoint={setHoveredPoint}
        togglePoint={togglePoint}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
        }}
      >
        <HoverInfoBox isDark={isDark} point={lastHoveredPoint} />
        <CategoryKey categories={categoryEntries} isDark={isDark} />

        <div className="absolute top-3 left-3 flex items-center gap-1 pointer-events-auto">
          <button
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] backdrop-blur-sm transition-colors ${
              selectMode
                ? isDark
                  ? "border-blue-500/40 bg-blue-500/15 text-blue-400"
                  : "border-blue-500/40 bg-blue-500/10 text-blue-600"
                : isDark
                  ? "border-white/[0.06] bg-black/60 text-white/40 hover:text-white/60"
                  : "border-black/[0.06] bg-white/70 text-black/40 hover:text-black/60"
            }`}
            onClick={() => setSelectMode((m) => !m)}
            type="button"
          >
            <BoxSelectIcon className="size-3" />
            {selectMode ? "Selecting" : "Select"}
          </button>

          {state.selectedPoints.length > 0 && (
            <button
              className={`flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] backdrop-blur-sm transition-colors ${
                isDark
                  ? "border-white/[0.06] bg-black/60 text-white/40 hover:text-red-400"
                  : "border-black/[0.06] bg-white/70 text-black/40 hover:text-red-500"
              }`}
              onClick={() => {
                clearSelection();
                setSelectMode(false);
              }}
              type="button"
            >
              <XIcon className="size-3" />
              Clear ({state.selectedPoints.length})
            </button>
          )}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 flex items-end gap-2">
        <MatrixEditorPanel
          basisMatrix={basisMatrix}
          isDark={isDark}
          onMatrixChange={setBasisMatrix}
        />
        <LimelightNav
          activeIndex={isDark ? 1 : 0}
          isDark={isDark}
          items={[
            {
              icon: <Sun size={16} />,
              label: "Light mode",
              onClick: () => setTheme("light"),
            },
            {
              icon: <Moon size={16} />,
              label: "Dark mode",
              onClick: () => setTheme("dark"),
            },
          ]}
        />
      </div>
    </>
  );
}
