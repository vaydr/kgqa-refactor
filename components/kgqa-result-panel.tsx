"use client";

import { CopyIcon, NetworkIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { KGQAStep } from "@/lib/types";
import { ForceDirectedGraph } from "./force-directed-graph";
import { useKGQA } from "./kgqa-provider";
import {
  getKGQAViewPresentation,
  type KGQAViewMode,
} from "./kgqa-view-mode";
import { toast } from "./toast";

type StepStatus = "complete" | "active" | "pending";

function getStepStatus(
  currentStep: KGQAStep | "idle",
  checkStep: string,
  hasClassification: boolean
): StepStatus {
  if (currentStep === checkStep) return "active";
  const stepOrder = hasClassification
    ? ["classify", "clauses", "graph", "answer", "complete"]
    : ["clauses", "graph", "answer", "complete"];
  const currentIdx = stepOrder.indexOf(currentStep);
  const checkIdx = stepOrder.indexOf(checkStep);
  if (currentStep === "complete" || currentIdx > checkIdx) return "complete";
  return "pending";
}

interface PipelineStep {
  key: string;
  label: string;
}

function PipelineBar({
  currentStep,
  hasClassification,
}: {
  currentStep: KGQAStep | "idle";
  hasClassification: boolean;
}) {
  const steps: PipelineStep[] = useMemo(() => {
    const s: PipelineStep[] = [];
    if (hasClassification) s.push({ key: "classify", label: "Classify" });
    s.push({ key: "clauses", label: "Clauses" });
    s.push({ key: "graph", label: "Graph" });
    s.push({ key: "answer", label: "Answer" });
    return s;
  }, [hasClassification]);

  return (
    <div className="flex shrink-0 items-center justify-center gap-0 border-b px-4 py-2">
      {steps.map((step, i) => {
        const status = getStepStatus(currentStep, step.key, hasClassification);
        const prevStatus =
          i > 0
            ? getStepStatus(currentStep, steps[i - 1].key, hasClassification)
            : null;
        const lineComplete = prevStatus === "complete";

        return (
          <div className="flex items-center" key={step.key}>
            {i > 0 && (
              <div
                className={`h-px w-10 ${
                  lineComplete
                    ? "bg-emerald-500/50"
                    : "border-muted-foreground/30 border-t border-dashed"
                }`}
              />
            )}

            <div className="flex flex-col items-center gap-1">
              <div
                className={`size-2 rounded-full ${
                  status === "complete"
                    ? "bg-emerald-500"
                    : status === "active"
                      ? "animate-pulse bg-blue-500"
                      : "border border-muted-foreground/30"
                }`}
              />
              <span className="text-[10px] text-muted-foreground">
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function KGQAResultPanel({
  currentQuestion,
  currentStudyNumber,
  viewMode,
}: {
  currentQuestion?: string;
  currentStudyNumber?: string;
  viewMode: KGQAViewMode;
}) {
  const { state } = useKGQA();

  const clauseNodes = useMemo(() => {
    return new Set(
      state.clauses?.clauses
        .flatMap((c) => [c.node1, c.node2])
        .filter((node): node is string => !!node) ?? []
    );
  }, [state.clauses]);

  const hasClassification = !!state.classification;
  const isUncontained = state.classification?.category === "Uncontained";

  const showGraph =
    !isUncontained && state.graph && state.graph.triples.length > 0;
  const showBottomStatus = Boolean(
    (!isUncontained &&
      state.answer &&
      (state.answer.answer || state.answer.reasoning)) ||
    (isUncontained &&
      state.directAnswer &&
      (state.directAnswer.answer || state.directAnswer.reasoning)) ||
    state.error
  );
  const answerPanelRef = useRef<ImperativePanelHandle>(null);
  const { blurAnswer, blurGraph } = getKGQAViewPresentation(viewMode);

  useEffect(() => {
    const answerPanel = answerPanelRef.current;

    if (!answerPanel) {
      return;
    }

    if (showBottomStatus) {
      answerPanel.resize(30);
      return;
    }

    answerPanel.collapse();
  }, [showBottomStatus]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-1 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">
            Current Question
          </span>
          {currentStudyNumber ? (
            <>
              <span className="font-bold font-mono text-[12px] text-blue-600 uppercase tracking-widest dark:text-blue-300">
                Study ID {currentStudyNumber}
              </span>
              <button
                aria-label={`Copy study ID ${currentStudyNumber}`}
                className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded border border-blue-500/40 bg-blue-500/10 text-blue-600 transition-colors hover:bg-blue-500/20 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                data-testid="kgqa-study-number-chip"
                onClick={() => {
                  navigator.clipboard
                    .writeText(currentStudyNumber)
                    .then(() =>
                      toast({
                        type: "success",
                        description: `Copied study ID ${currentStudyNumber}`,
                      })
                    )
                    .catch(() =>
                      toast({
                        type: "error",
                        description: "Failed to copy study ID",
                      })
                    );
                }}
                title={`Copy study ID ${currentStudyNumber}`}
                type="button"
              >
                <CopyIcon className="size-3" />
              </button>
            </>
          ) : null}
        </div>
        <p
          className="line-clamp-2 text-foreground/85 text-sm"
          data-testid="kgqa-current-question"
        >
          {currentQuestion?.trim() || "Waiting for a question..."}
        </p>
      </div>

      {showGraph ? (
        <ResizablePanelGroup
          autoSaveId="kgqa-graph-answer"
          className="min-h-0 flex-1"
          direction="vertical"
        >
          <ResizablePanel defaultSize={100} minSize={40}>
            <div
              className="relative h-full min-h-0 overflow-hidden"
              data-testid="kgqa-graph-region"
            >
              <div className={`h-full min-h-0 ${blurGraph ? "pointer-events-none" : ""}`}>
                {state.step === "graph" ? (
                  <GraphLoader tripleCount={state.graph?.triples.length ?? 0} />
                ) : (
                  <ForceDirectedGraph
                    clauseNodes={clauseNodes}
                    clauses={state.clauses?.clauses ?? []}
                    isComplete={true}
                    neutralAccent={blurGraph}
                    triples={state.graph?.triples ?? []}
                  />
                )}
              </div>

              {blurGraph ? (
                <BlurOverlay testId="kgqa-graph-blur-overlay" />
              ) : null}
            </div>
          </ResizablePanel>
          <ResizableHandle
            className={
              showBottomStatus ? undefined : "pointer-events-none opacity-0"
            }
            withHandle={showBottomStatus}
          />
          <ResizablePanel
            collapsedSize={0}
            collapsible
            defaultSize={0}
            minSize={0}
            ref={answerPanelRef}
          >
            {showBottomStatus ? (
              <AnswerFooter
                blurAnswer={blurAnswer}
                isUncontained={isUncontained}
                state={state}
              />
            ) : null}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="flex max-w-xl flex-col items-center gap-3">
            {isUncontained &&
              state.directAnswer &&
              (state.directAnswer.answer || state.directAnswer.reasoning) && (
                <div className="flex flex-col items-center gap-2 text-center">
                  {state.directAnswer.answer && (
                    <p className="text-muted-foreground text-sm">
                      {state.directAnswer.answer}
                    </p>
                  )}
                </div>
              )}

            {state.error && <PathFailureAnimation error={state.error} />}

            {!isUncontained && !state.error && <BuildingAnimation />}
          </div>
        </div>
      )}
    </div>
  );
}

function BlurOverlay({ testId }: { testId: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-background/25 backdrop-blur-[60px]"
      data-testid={testId}
    />
  );
}

function GraphLoader({ tripleCount }: { tripleCount: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  const nodes = useRef(
    Array.from({ length: 12 }, (_, i) => ({
      x: 0,
      y: 0,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      angle: (i / 12) * Math.PI * 2 + Math.random() * 0.6,
      dist: 16 + Math.random() * 80,
      phase: Math.random() * Math.PI * 2,
      radius: 3 + Math.random() * 4,
      speed: 0.5 + Math.random() * 1.5,
    }))
  );

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

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
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const draw = (time: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      const t = time * 0.001;
      const cx = w / 2;
      const cy = h / 2;
      const ns = nodes.current;

      for (const n of ns) {
        const jitterX = (Math.random() - 0.5) * 1.2;
        const jitterY = (Math.random() - 0.5) * 1.2;
        const breathe = Math.sin(t * 2.5 + n.phase) * 12;
        const targetX =
          cx +
          Math.cos(n.angle + t * 0.4 * n.speed) * (n.dist + breathe) +
          Math.sin(t * 3 + n.phase) * 16;
        const targetY =
          cy +
          Math.sin(n.angle + t * 0.4 * n.speed) * (n.dist + breathe) +
          Math.cos(t * 2.2 + n.phase) * 12;
        n.vx += (targetX - n.x) * 0.08 + jitterX;
        n.vy += (targetY - n.y) * 0.08 + jitterY;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
      }

      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[j].x - ns[i].x;
          const dy = ns[j].y - ns[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const alpha = (1 - dist / 140) * 0.25;
            ctx.beginPath();
            ctx.moveTo(ns[i].x, ns[i].y);
            ctx.lineTo(ns[j].x, ns[j].y);
            ctx.strokeStyle = `rgba(100, 160, 255, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      for (const n of ns) {
        const flicker = 0.8 + Math.sin(t * 6 + n.phase) * 0.2;
        const r = n.radius * (1 + Math.sin(t * 4 + n.phase) * 0.15);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 160, 255, ${0.4 * flicker})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full items-center justify-center"
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="relative z-10 flex flex-col items-center gap-2">
        <p className="font-mono text-muted-foreground/50 text-xs">
          Building subgraph...
        </p>
        <p className="font-mono text-[10px] text-muted-foreground/30">
          {tripleCount} triples
        </p>
      </div>
    </div>
  );
}

function PathFailureAnimation({ error }: { error: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  const particles = useRef(
    Array.from({ length: 8 }, (_, i) => ({
      x: 0,
      y: 0,
      angle: (i / 8) * Math.PI * 2 + Math.random() * 0.3,
      startDist: 10 + Math.random() * 15,
      driftSpeed: 0.3 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      radius: 3 + Math.random() * 3,
    }))
  );

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let w = 0;
    let h = 0;
    const startTime = performance.now();

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
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const draw = (time: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      const elapsed = (time - startTime) * 0.001;
      const t = time * 0.001;
      const cx = w / 2;
      const cy = h / 2;
      const ps = particles.current;

      const driftProgress = Math.min(1, elapsed * 0.3);
      const positions: { x: number; y: number }[] = [];

      for (const p of ps) {
        const dist = p.startDist + driftProgress * 50 * p.driftSpeed;
        const wobble = Math.sin(t * 0.6 + p.phase) * 3;
        const x = cx + Math.cos(p.angle + Math.sin(t * 0.1) * 0.05) * dist + wobble;
        const y = cy + Math.sin(p.angle + Math.sin(t * 0.1) * 0.05) * dist + Math.cos(t * 0.5 + p.phase) * 2;
        positions.push({ x, y });
      }

      for (let i = 0; i < ps.length; i++) {
        const j = (i + 1) % ps.length;
        const pa = positions[i];
        const pb = positions[j];
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const alpha = Math.max(0, (1 - dist / 160)) * 0.15 * (1 - driftProgress * 0.5);
        if (alpha > 0) {
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.strokeStyle = `rgba(160, 140, 120, ${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const pos = positions[i];
        const pulse = 1 + Math.sin(t * 0.8 + p.phase) * 0.06;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, p.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(160, 140, 120, ${0.25 - driftProgress * 0.08})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      observer.disconnect();
    };
  }, []);

  const friendlyMessage = error.includes("disconnected")
    ? "Path-finding incomplete"
    : error.includes("No clauses")
      ? "No reasoning path found"
      : error.includes("No graph")
        ? "Subgraph construction failed"
        : "Path-finding failed";

  return (
    <div
      ref={containerRef}
      className="relative flex h-full min-h-[200px] w-full items-center justify-center"
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="relative z-10 flex flex-col items-center gap-2">
        <p className="font-mono text-muted-foreground/40 text-xs uppercase tracking-wide">
          {friendlyMessage}
        </p>
        <p className="max-w-[280px] text-center text-[10px] text-muted-foreground/30">
          Try rephrasing your question or selecting different nodes
        </p>
      </div>
    </div>
  );
}

function BuildingAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  const layout = useRef(
    Array.from({ length: 8 }, (_, i) => ({
      angle: (i % 4) / 4 * Math.PI * 2 + (i >= 4 ? Math.PI / 4 : 0),
      dist: i < 4 ? 30 : 60,
      radius: i < 4 ? 5 : 3.5,
      phase: i * 0.8,
      appearAt: i * 0.4,
    }))
  );

  const edgePairs = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [0, 4], [1, 5], [2, 6], [3, 7],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 5], [2, 7],
  ];

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let w = 0;
    let h = 0;
    const startTime = performance.now();

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
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const draw = (time: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      const elapsed = (time - startTime) * 0.001;
      const t = time * 0.001;
      const cx = w / 2;
      const cy = h / 2;
      const nodes = layout.current;

      const positions: { x: number; y: number; alpha: number }[] = [];
      for (const n of nodes) {
        const age = elapsed - n.appearAt;
        const alpha = Math.min(1, Math.max(0, age * 2));
        const breathe = Math.sin(t * 0.8 + n.phase) * 4;
        const x = cx + Math.cos(n.angle + t * 0.08) * (n.dist + breathe);
        const y = cy + Math.sin(n.angle + t * 0.08) * (n.dist + breathe);
        positions.push({ x, y, alpha });
      }

      for (const [a, b] of edgePairs) {
        const pa = positions[a];
        const pb = positions[b];
        const edgeAlpha = Math.min(pa.alpha, pb.alpha) * 0.2;
        if (edgeAlpha <= 0) continue;

        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = `rgba(140, 160, 200, ${edgeAlpha})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const p = positions[i];
        if (p.alpha <= 0) continue;

        const pulse = 1 + Math.sin(t * 1.5 + n.phase) * 0.08;
        const r = n.radius * pulse;

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(140, 160, 200, ${p.alpha * 0.3})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(140, 160, 200, ${p.alpha * 0.15})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full min-h-[200px] w-full items-center justify-center"
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="relative z-10 flex flex-col items-center gap-2">
        <p className="font-mono text-muted-foreground/40 text-xs">
          Building knowledge graph...
        </p>
      </div>
    </div>
  );
}

function AnswerFooter({
  blurAnswer,
  state,
  isUncontained,
}: {
  blurAnswer: boolean;
  state: ReturnType<typeof useKGQA>["state"];
  isUncontained: boolean;
}) {
  return (
    <div
      className="relative flex h-full flex-col overflow-y-auto border-t bg-muted/30 px-5 py-4"
      data-testid="graph-status-panel"
      data-region="kgqa-answer"
    >

      {!isUncontained &&
        state.answer &&
        (state.answer.answer || state.answer.reasoning) && (
          <div className="space-y-2">
            {state.answer.answer && (
              <div>
                <p className="mb-1.5 font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">
                  Answer
                </p>
                <p className="font-semibold text-foreground text-xl leading-snug tracking-tight">
                  {state.answer.answer}
                </p>
              </div>
            )}
          </div>
        )}

      {state.error && (
        <div className="flex items-center gap-2 text-muted-foreground/60">
          <p className="font-mono text-xs">Path-finding failed. Try rephrasing your question.</p>
        </div>
      )}

      {blurAnswer ? <BlurOverlay testId="kgqa-answer-blur-overlay" /> : null}
    </div>
  );
}
