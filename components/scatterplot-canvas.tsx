"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const ScatterplotCanvasInner = dynamic(
  () => import("./scatterplot-canvas-inner").then((mod) => mod.ScatterplotCanvasInner),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0" />,
  }
);

interface ScatterplotCanvasProps {
  className?: string;
}

export function ScatterplotCanvas({ className }: ScatterplotCanvasProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const dotColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";

  return (
    <div
      className={cn(
        "absolute inset-0",
        isDark
          ? "bg-gradient-to-br from-[#0a0a0f] via-[#0d0d14] to-[#0a0a0f]"
          : "bg-gradient-to-br from-slate-50 via-white to-slate-50",
        className
      )}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, ${dotColor} 0.5px, transparent 0.5px)`,
          backgroundSize: '24px 24px',
        }}
      />
      <div className={cn(
        "absolute inset-0",
        isDark
          ? "bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.15)_100%)]"
          : "bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.03)_100%)]"
      )} />
      <ScatterplotCanvasInner />
    </div>
  );
}
