"use client";

import { useCallback, useEffect, useRef } from "react";
import { useKGQA } from "./kgqa-provider";
import { KGQAResultPanel } from "./kgqa-result-panel";
import type { KGQAViewMode } from "./kgqa-view-mode";

function SwimmingNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const hasMouseEntered = useRef(false);
  const animRef = useRef<number>(0);

  const nodes = useRef(
    Array.from({ length: 6 }, (_, i) => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: (i / 6) * Math.PI * 2 + Math.random() * 0.4,
      dist: i === 0 ? 0 : 32 + Math.random() * 28,
      phase: Math.random() * Math.PI * 2,
      radius: i === 0 ? 7 : 4 + Math.random() * 3,
    }))
  );

  const edges = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 2], [2, 3], [3, 4], [4, 5], [5, 1],
    [1, 3], [2, 5],
  ];

  const center = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    hasMouseEntered.current = true;
  }, []);

  const handleMouseLeave = useCallback(() => {
    hasMouseEntered.current = false;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      if (center.current.x === 0) {
        center.current = { x: w / 2, y: h / 2 };
        mouse.current = { x: w / 2, y: h / 2 };
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const draw = (time: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, w, h);

      const t = time * 0.001;

      const target = hasMouseEntered.current
        ? mouse.current
        : { x: w / 2 + Math.sin(t * 0.3) * 120, y: h / 2 + Math.cos(t * 0.2) * 80 };
      center.current.x += (target.x - center.current.x) * 0.02;
      center.current.y += (target.y - center.current.y) * 0.02;

      const cx = center.current.x;
      const cy = center.current.y;

      const ns = nodes.current;
      for (let i = 0; i < ns.length; i++) {
        const n = ns[i];
        const sway = Math.sin(t * 1.2 + n.phase) * 8;
        const breathe = Math.sin(t * 0.8 + n.phase * 0.5) * 6;
        const targetX = cx + Math.cos(n.angle + t * 0.15) * (n.dist + breathe) + sway;
        const targetY = cy + Math.sin(n.angle + t * 0.15) * (n.dist + breathe) + Math.cos(t * 0.9 + n.phase) * 6;
        n.vx += (targetX - n.x) * 0.06;
        n.vy += (targetY - n.y) * 0.06;
        n.vx *= 0.88;
        n.vy *= 0.88;
        n.x += n.vx;
        n.y += n.vy;
      }

      for (const [a, b] of edges) {
        const na = ns[a];
        const nb = ns[b];
        const dx = nb.x - na.x;
        const dy = nb.y - na.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const alpha = Math.max(0, 1 - dist / 160) * 0.2;
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(nb.x, nb.y);
        ctx.strokeStyle = `rgba(140, 160, 200, ${alpha})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      for (let i = 0; i < ns.length; i++) {
        const n = ns[i];
        const pulse = 1 + Math.sin(t * 2 + n.phase) * 0.1;
        const r = n.radius * pulse;
        const alpha = i === 0 ? 0.35 : 0.2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(140, 160, 200, ${alpha})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      observer.disconnect();
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}

export function MainContentArea({
  currentQuestion,
  currentStudyNumber,
  viewMode,
}: {
  currentQuestion?: string;
  currentStudyNumber?: string;
  viewMode: KGQAViewMode;
}) {
  const { state } = useKGQA();

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="graph-hero-shell"
    >
      {state.step === "idle" ? (
        <div
          className="relative flex min-h-0 flex-1 items-center justify-center"
          style={{
            backgroundImage:
              "radial-gradient(circle, hsl(var(--muted-foreground) / 0.06) 0.5px, transparent 0.5px)",
            backgroundSize: "24px 24px",
          }}
        >
          <SwimmingNetwork />

          <div className="relative z-10 flex flex-col items-center gap-5">
            <p className="font-mono text-muted-foreground/40 text-xs uppercase tracking-wide">
              Ask a question to see the answer-path subgraph
            </p>
            <div className="h-px w-16 bg-border/50" />
          </div>
        </div>
      ) : (
        <KGQAResultPanel
          currentQuestion={currentQuestion}
          currentStudyNumber={currentStudyNumber}
          viewMode={viewMode}
        />
      )}
    </div>
  );
}
