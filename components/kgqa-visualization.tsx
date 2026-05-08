"use client";

import {
  BrainIcon,
  CheckIcon,
  FilterIcon,
  LoaderIcon,
  MessageSquareIcon,
  NetworkIcon,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KGQAStep } from "@/lib/types";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "./ai-elements/chain-of-thought";
import { useKGQA } from "./kgqa-provider";

function getStepStatus(
  currentStep: KGQAStep | "idle",
  checkStep: string,
  hasClassification: boolean
): "complete" | "active" | "pending" {
  if (currentStep === checkStep) return "active";
  const stepOrder = hasClassification
    ? ["classify", "clauses", "graph", "answer", "complete"]
    : ["clauses", "graph", "answer", "complete"];
  const currentIdx = stepOrder.indexOf(currentStep);
  const checkIdx = stepOrder.indexOf(checkStep);
  if (currentStep === "complete" || currentIdx > checkIdx) return "complete";
  return "pending";
}

function StepIcon({
  currentStep,
  checkStep,
  hasClassification,
}: {
  currentStep: KGQAStep | "idle";
  checkStep: string;
  hasClassification: boolean;
}) {
  const status = getStepStatus(currentStep, checkStep, hasClassification);
  if (status === "active") {
    return <LoaderIcon className="size-4 animate-spin" />;
  }
  if (status === "complete") {
    return <CheckIcon className="size-4 text-green-500" />;
  }
  return null;
}

type GraphNode = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isClause: boolean;
};

type GraphEdge = {
  source: string;
  target: string;
  label: string;
  score: number;
  isReasoningPath: boolean;
  isFlipped: boolean;
};

type Clause = {
  node1: string;
  relationship: string;
  node2: string;
};

function ForceDirectedGraph({
  triples,
  clauseNodes,
  clauses,
  isComplete,
}: {
  triples: { node1: string; relationship: string; node2: string; score: number }[];
  clauseNodes: Set<string>;
  clauses: Clause[];
  isComplete: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const animationRef = useRef<number>();
  const [simulationStarted, setSimulationStarted] = useState(false);

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  const [showHeatmap, setShowHeatmap] = useState(false);

  const getHeatmapColor = (score: number): string => {
    const clampedScore = Math.max(0, Math.min(1, score));
    if (clampedScore < 0.25) {
      const t = clampedScore / 0.25;
      return `rgb(${Math.round(59 + t * 0)}, ${Math.round(130 + t * 70)}, ${Math.round(246 - t * 46)})`;
    } else if (clampedScore < 0.5) {
      const t = (clampedScore - 0.25) / 0.25;
      return `rgb(${Math.round(59 - t * 37)}, ${Math.round(200 + t * 55)}, ${Math.round(200 - t * 128)})`;
    } else if (clampedScore < 0.75) {
      const t = (clampedScore - 0.5) / 0.25;
      return `rgb(${Math.round(22 + t * 212)}, ${Math.round(255 - t * 51)}, ${Math.round(72 - t * 72)})`;
    } else {
      const t = (clampedScore - 0.75) / 0.25;
      return `rgb(${Math.round(234 + t * 5)}, ${Math.round(204 - t * 154)}, ${Math.round(0)})`;
    }
  };

  const reasoningEdgesMap = useMemo(() => {
    const edgeMap = new Map<string, { flipped: boolean }>();
    clauses.forEach((c) => {
      const forwardKey = `${c.node1}|${c.relationship}|${c.node2}`;
      const reverseKey = `${c.node2}|${c.relationship}|${c.node1}`;
      edgeMap.set(forwardKey, { flipped: false });
      edgeMap.set(reverseKey, { flipped: true });
    });
    return edgeMap;
  }, [clauses]);

  useEffect(() => {
    const nodeMap = new Map<string, GraphNode>();
    const edgeList: GraphEdge[] = [];

    const completeTriples = triples.filter(
      (t) => t && t.node1 && t.node2 && t.relationship &&
        typeof t.node1 === 'string' && typeof t.node2 === 'string'
    );

    completeTriples.forEach((triple) => {
      if (!nodeMap.has(triple.node1)) {
        nodeMap.set(triple.node1, {
          id: triple.node1,
          x: Math.random() * 800 + 100,
          y: Math.random() * 500 + 100,
          vx: 0,
          vy: 0,
          isClause: clauseNodes.has(triple.node1),
        });
      }
      if (!nodeMap.has(triple.node2)) {
        nodeMap.set(triple.node2, {
          id: triple.node2,
          x: Math.random() * 800 + 100,
          y: Math.random() * 500 + 100,
          vx: 0,
          vy: 0,
          isClause: clauseNodes.has(triple.node2),
        });
      }

      const edgeKey = `${triple.node1}|${triple.relationship}|${triple.node2}`;
      const reasoningInfo = reasoningEdgesMap.get(edgeKey);
      const isReasoningPath = !!reasoningInfo;
      const isFlipped = reasoningInfo?.flipped ?? false;

      edgeList.push({
        source: triple.node1,
        target: triple.node2,
        label: triple.relationship,
        score: triple.score ?? 0.5,
        isReasoningPath,
        isFlipped,
      });
    });

    setNodes(Array.from(nodeMap.values()));
    setEdges(edgeList);
  }, [triples, clauseNodes, reasoningEdgesMap]);

  useEffect(() => {
    if (isComplete && !simulationStarted && nodes.length > 0) {
      setSimulationStarted(true);
    }
  }, [isComplete, simulationStarted, nodes.length]);

  const [hasCentered, setHasCentered] = useState(false);
  useEffect(() => {
    if (simulationStarted && !hasCentered && nodes.length > 0) {
      const timer = setTimeout(() => {
        resetView();
        setHasCentered(true);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [simulationStarted, hasCentered, nodes.length]);

  useEffect(() => {
    if (!simulationStarted || nodes.length === 0) return;

    let iteration = 0;
    const maxIterations = 200;

    const simulate = () => {
      if (iteration >= maxIterations) return;

      setNodes((prevNodes) => {
        const newNodes = prevNodes.map((node) => ({ ...node }));

        for (let i = 0; i < newNodes.length; i++) {
          for (let j = i + 1; j < newNodes.length; j++) {
            const dx = newNodes[j].x - newNodes[i].x;
            const dy = newNodes[j].y - newNodes[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 5000 / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (newNodes[i].id !== draggedNode) {
              newNodes[i].vx -= fx;
              newNodes[i].vy -= fy;
            }
            if (newNodes[j].id !== draggedNode) {
              newNodes[j].vx += fx;
              newNodes[j].vy += fy;
            }
          }
        }

        edges.forEach((edge) => {
          const source = newNodes.find((n) => n.id === edge.source);
          const target = newNodes.find((n) => n.id === edge.target);
          if (source && target) {
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const idealDist = edge.isReasoningPath ? 100 : 150;
            const force = (dist - idealDist) * 0.03;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (source.id !== draggedNode) {
              source.vx += fx;
              source.vy += fy;
            }
            if (target.id !== draggedNode) {
              target.vx -= fx;
              target.vy -= fy;
            }
          }
        });

        const centerX = 500;
        const centerY = 350;
        newNodes.forEach((node) => {
          if (node.id !== draggedNode) {
            node.vx += (centerX - node.x) * 0.005;
            node.vy += (centerY - node.y) * 0.005;
          }
        });

        newNodes.forEach((node) => {
          if (node.id !== draggedNode) {
            node.vx *= 0.85;
            node.vy *= 0.85;
            node.x += node.vx;
            node.y += node.vy;
          } else {
            node.vx = 0;
            node.vy = 0;
          }
        });

        return newNodes;
      });

      iteration++;
      animationRef.current = requestAnimationFrame(simulate);
    };

    animationRef.current = requestAnimationFrame(simulate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [simulationStarted, nodes.length, edges, draggedNode]);

  const { nodeScores, nodeAvgScores } = useMemo(() => {
    const scores = new Map<string, number>();
    const counts = new Map<string, number>();
    edges.forEach((edge) => {
      scores.set(edge.source, (scores.get(edge.source) || 0) + edge.score);
      scores.set(edge.target, (scores.get(edge.target) || 0) + edge.score);
      counts.set(edge.source, (counts.get(edge.source) || 0) + 1);
      counts.set(edge.target, (counts.get(edge.target) || 0) + 1);
    });
    const avgScores = new Map<string, number>();
    scores.forEach((sum, nodeId) => {
      const count = counts.get(nodeId) || 1;
      avgScores.set(nodeId, sum / count);
    });
    return { nodeScores: scores, nodeAvgScores: avgScores };
  }, [edges]);

  const { minScore, maxScore } = useMemo(() => {
    const values = Array.from(nodeScores.values());
    if (values.length === 0) return { minScore: 0, maxScore: 1 };
    return {
      minScore: Math.min(...values),
      maxScore: Math.max(...values),
    };
  }, [nodeScores]);

  const getNodeColor = (nodeId: string, isClause: boolean): string => {
    if (!showHeatmap) {
      return isClause ? "#1e40af" : "var(--muted)";
    }
    const avgScore = nodeAvgScores.get(nodeId) || 0.5;
    return getHeatmapColor(avgScore);
  };

  const getNodeRadius = (nodeId: string, isClause: boolean): number => {
    const baseMin = isClause ? 18 : 12;
    const baseMax = isClause ? 32 : 24;
    const score = nodeScores.get(nodeId) || 0;
    const normalized = maxScore > minScore
      ? (score - minScore) / (maxScore - minScore)
      : 0.5;
    return baseMin + normalized * (baseMax - baseMin);
  };

  const nodePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number; isClause: boolean; radius: number }>();
    nodes.forEach((n) => map.set(n.id, {
      x: n.x,
      y: n.y,
      isClause: n.isClause,
      radius: getNodeRadius(n.id, n.isClause),
    }));
    return map;
  }, [nodes, nodeScores, minScore, maxScore]);

  const screenToGraph = (screenX: number, screenY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (screenX - rect.left - transform.x) / transform.scale,
      y: (screenY - rect.top - transform.y) / transform.scale,
    };
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const graphPos = screenToGraph(e.clientX, e.clientY);
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setDraggedNode(nodeId);
      setDragOffset({ x: graphPos.x - node.x, y: graphPos.y - node.y });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !draggedNode) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNode) {
      const graphPos = screenToGraph(e.clientX, e.clientY);
      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === draggedNode
            ? { ...node, x: graphPos.x - dragOffset.x, y: graphPos.y - dragOffset.y }
            : node
        )
      );
    } else if (isPanning) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNode(null);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
    setDraggedNode(null);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(transform.scale * scaleFactor, 0.3), 3);

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setTransform((prev) => ({
        scale: newScale,
        x: mouseX - (mouseX - prev.x) * (newScale / prev.scale),
        y: mouseY - (mouseY - prev.y) * (newScale / prev.scale),
      }));
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [transform.scale]);

  const resetView = () => {
    if (nodes.length === 0 || !containerRef.current) {
      setTransform({ x: 0, y: 0, scale: 1 });
      return;
    }

    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const graphWidth = maxX - minX + 100;
    const graphHeight = maxY - minY + 100;
    const graphCenterX = (minX + maxX) / 2;
    const graphCenterY = (minY + maxY) / 2;

    const rect = containerRef.current.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    const scaleX = containerWidth / graphWidth;
    const scaleY = containerHeight / graphHeight;
    const scale = Math.min(scaleX, scaleY, 1.2);

    const x = containerWidth / 2 - graphCenterX * scale;
    const y = containerHeight / 2 - graphCenterY * scale;

    setTransform({ x, y, scale });
  };

  const getEdgeKey = (node1: string, rel: string, node2: string) =>
    `${node1}|${rel}|${node2}`;

  return (
    <div className="flex flex-col h-full select-none">
      {clauses.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30 overflow-x-auto">
          <span className="text-xs text-muted-foreground mr-1">Answer Path:</span>
          {clauses.map((clause, i) => {
            const edgeKey = getEdgeKey(clause.node1, clause.relationship, clause.node2);
            const isHovered = hoveredEdge === edgeKey;
            const matchingEdge = edges.find(
              (e) => e.isReasoningPath && e.label === clause.relationship &&
              ((e.source === clause.node1 && e.target === clause.node2) ||
               (e.source === clause.node2 && e.target === clause.node1))
            );
            const pillColor = showHeatmap && matchingEdge
              ? getHeatmapColor(matchingEdge.score)
              : (isHovered ? "#1e3a8a" : "#1e40af");
            return (
              <div key={`pill-${i}`} className="flex items-center gap-1">
                <button
                  type="button"
                  className="px-2.5 py-1 text-xs font-medium rounded-full transition-all text-white"
                  style={{
                    backgroundColor: pillColor,
                    transform: isHovered ? "scale(1.05)" : "scale(1)",
                    boxShadow: isHovered ? "0 4px 6px -1px rgba(0,0,0,0.1)" : "none",
                  }}
                  onMouseEnter={() => setHoveredEdge(edgeKey)}
                  onMouseLeave={() => setHoveredEdge(null)}
                >
                  {clause.relationship}
                </button>
                {i < clauses.length - 1 && (
                  <span className="text-muted-foreground text-sm">→</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <button
            onClick={() => setShowHeatmap((prev) => !prev)}
            className={`px-2 py-1 text-xs border rounded transition-colors ${
              showHeatmap
                ? "bg-[#1e40af] text-white border-[#1e40af]"
                : "bg-background hover:bg-muted"
            }`}
            type="button"
            title="Toggle score heatmap"
          >
            Heatmap
          </button>
          <button
            onClick={() => setTransform((prev) => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3) }))}
            className="px-2 py-1 text-xs bg-background border rounded hover:bg-muted"
            type="button"
          >
            +
          </button>
          <button
            onClick={() => setTransform((prev) => ({ ...prev, scale: Math.max(prev.scale * 0.8, 0.3) }))}
            className="px-2 py-1 text-xs bg-background border rounded hover:bg-muted"
            type="button"
          >
            −
          </button>
          <button
            onClick={resetView}
            className="px-2 py-1 text-xs bg-background border rounded hover:bg-muted"
            type="button"
          >
            Reset
          </button>
        </div>

      {showHeatmap && (
        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 text-xs bg-background/90 px-2 py-1 rounded border">
          <span className="text-muted-foreground">0</span>
          <span
            className="w-20 h-1.5 rounded-full"
            style={{
              background: "linear-gradient(to right, #3b82f6, #22d3ee, #22c55e, #eab308, #ef4444)",
            }}
          />
          <span className="text-muted-foreground">1</span>
        </div>
      )}

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ background: "var(--background)", userSelect: "none" }}
      >
        <defs>
          <marker
            id="arrowhead-normal"
            markerWidth="4"
            markerHeight="3"
            refX="4"
            refY="1.5"
            orient="auto"
          >
            <polygon
              points="0 0, 4 1.5, 0 3"
              fill="var(--muted-foreground)"
              opacity="0.5"
            />
          </marker>
          <marker
            id="arrowhead-reasoning"
            markerWidth="5"
            markerHeight="4"
            refX="5"
            refY="2"
            orient="auto"
          >
            <polygon points="0 0, 5 2, 0 4" fill="#1e40af" />
          </marker>
          <marker
            id="arrowhead-heatmap"
            markerWidth="4"
            markerHeight="3"
            refX="4"
            refY="1.5"
            orient="auto"
          >
            <polygon
              points="0 0, 4 1.5, 0 3"
              fill="context-stroke"
            />
          </marker>
        </defs>

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {edges
            .sort((a, b) => (a.isReasoningPath ? 1 : 0) - (b.isReasoningPath ? 1 : 0))
            .map((edge, i) => {
              const actualSource = edge.isFlipped
                ? nodePositions.get(edge.target)
                : nodePositions.get(edge.source);
              const actualTarget = edge.isFlipped
                ? nodePositions.get(edge.source)
                : nodePositions.get(edge.target);
              if (!actualSource || !actualTarget) return null;

              const dx = actualTarget.x - actualSource.x;
              const dy = actualTarget.y - actualSource.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;

              const sourceRadius = actualSource.radius + 2;
              const targetRadius = actualTarget.radius + 2;
              const x1 = actualSource.x + (dx / dist) * sourceRadius;
              const y1 = actualSource.y + (dy / dist) * sourceRadius;
              const x2 = actualTarget.x - (dx / dist) * (targetRadius + 4);
              const y2 = actualTarget.y - (dy / dist) * (targetRadius + 4);

              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              const isReasoning = edge.isReasoningPath;
              const edgeKey = getEdgeKey(edge.source, edge.label, edge.target);
              const isHovered = hoveredEdge === edgeKey;

              const labelPadding = 6;
              const labelWidth = edge.label.length * 7 + labelPadding * 2;
              const labelHeight = 18;

              return (
                <g
                  key={`edge-${i}`}
                  onMouseEnter={() => isReasoning && setHoveredEdge(edgeKey)}
                  onMouseLeave={() => setHoveredEdge(null)}
                >
                  {isReasoning && isHovered && (
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#60a5fa"
                      strokeWidth={20}
                      opacity={0.4}
                    />
                  )}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={
                      showHeatmap
                        ? getHeatmapColor(edge.score)
                        : isReasoning
                          ? (isHovered ? "#3b82f6" : "#1e40af")
                          : "var(--muted-foreground)"
                    }
                    strokeWidth={isReasoning ? (isHovered ? 12 : 10) : (showHeatmap ? 2.5 : 1.5)}
                    opacity={showHeatmap ? 0.85 : (isReasoning ? 1 : 0.3)}
                    markerEnd={
                      showHeatmap
                        ? "url(#arrowhead-heatmap)"
                        : isReasoning
                          ? "url(#arrowhead-reasoning)"
                          : "url(#arrowhead-normal)"
                    }
                  />
                  {!isReasoning && (
                    <>
                      <rect
                        x={midX - edge.label.length * 3.5}
                        y={midY - 8}
                        width={edge.label.length * 7}
                        height={14}
                        fill="var(--background)"
                        opacity="0.9"
                        rx="3"
                      />
                      <text
                        x={midX}
                        y={midY + 3}
                        fontSize="11"
                        fill="var(--muted-foreground)"
                        textAnchor="middle"
                      >
                        {edge.label}
                      </text>
                    </>
                  )}
                </g>
              );
            })}

          {nodes.map((node) => {
            const radius = getNodeRadius(node.id, node.isClause);
            const isDragging = draggedNode === node.id;
            return (
              <g
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                style={{ cursor: isDragging ? "grabbing" : "grab" }}
              >
                {node.isClause && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius + 2}
                    fill="none"
                    stroke="black"
                    strokeWidth={1.5}
                  />
                )}
                {isDragging && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius + 6}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    opacity={0.5}
                  />
                )}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={getNodeColor(node.id, node.isClause)}
                  stroke={showHeatmap ? "var(--border)" : (node.isClause ? "#1e3a8a" : "var(--border)")}
                  strokeWidth={isDragging ? 3 : 2}
                />
                <rect
                  x={node.x - Math.min(node.id.length * 4, 60)}
                  y={node.y + radius + 4}
                  width={Math.min(node.id.length * 8, 120)}
                  height={16}
                  fill="var(--background)"
                  opacity="0.9"
                  rx="3"
                />
                <text
                  x={node.x}
                  y={node.y + radius + 16}
                  fontSize="12"
                  fontWeight={node.isClause ? "600" : "400"}
                  fill={showHeatmap ? getNodeColor(node.id, node.isClause) : (node.isClause ? "#1e40af" : "var(--foreground)")}
                  textAnchor="middle"
                  style={{ pointerEvents: "none" }}
                >
                  {node.id.length > 20 ? `${node.id.slice(0, 18)}...` : node.id}
                </text>
              </g>
            );
          })}

          {edges
            .filter((edge) => edge.isReasoningPath)
            .map((edge, i) => {
              const actualSource = edge.isFlipped
                ? nodePositions.get(edge.target)
                : nodePositions.get(edge.source);
              const actualTarget = edge.isFlipped
                ? nodePositions.get(edge.source)
                : nodePositions.get(edge.target);
              if (!actualSource || !actualTarget) return null;

              const dx = actualTarget.x - actualSource.x;
              const dy = actualTarget.y - actualSource.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;

              const sourceRadius = actualSource.radius + 2;
              const targetRadius = actualTarget.radius + 2;
              const x1 = actualSource.x + (dx / dist) * sourceRadius;
              const y1 = actualSource.y + (dy / dist) * sourceRadius;
              const x2 = actualTarget.x - (dx / dist) * (targetRadius + 4);
              const y2 = actualTarget.y - (dy / dist) * (targetRadius + 4);

              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              const edgeKey = getEdgeKey(edge.source, edge.label, edge.target);
              const isHovered = hoveredEdge === edgeKey;

              const labelPadding = 6;
              const labelWidth = edge.label.length * 7 + labelPadding * 2;
              const labelHeight = 18;

              const labelColor = showHeatmap
                ? getHeatmapColor(edge.score)
                : (isHovered ? "#3b82f6" : "#1e40af");

              return (
                <g
                  key={`clause-label-${i}`}
                  onMouseEnter={() => setHoveredEdge(edgeKey)}
                  onMouseLeave={() => setHoveredEdge(null)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={midX - labelWidth / 2}
                    y={midY - labelHeight / 2}
                    width={labelWidth}
                    height={labelHeight}
                    fill={labelColor}
                    rx="9"
                    style={{ transition: "fill 0.15s" }}
                  />
                  <text
                    x={midX}
                    y={midY + 4}
                    fontSize="11"
                    fill="white"
                    fontWeight="600"
                    textAnchor="middle"
                    style={{ pointerEvents: "none" }}
                  >
                    {edge.label}
                  </text>
                </g>
              );
            })}
        </g>
      </svg>
      </div>
    </div>
  );
}

export function KGQAVisualization() {
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

  if (state.step === "idle") {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 my-4">
      <ChainOfThought defaultOpen>
        <ChainOfThoughtHeader>KGQA Reasoning Pipeline</ChainOfThoughtHeader>
        <ChainOfThoughtContent>
          {hasClassification && (
            <ChainOfThoughtStep
              icon={FilterIcon}
              label={
                <span className="flex items-center gap-2">
                  Classify Question
                  <StepIcon currentStep={state.step} checkStep="classify" hasClassification={hasClassification} />
                </span>
              }
              description={
                state.classification
                  ? `${state.classification.category}`
                  : "Classifying..."
              }
              status={getStepStatus(state.step, "classify", hasClassification)}
            >
              {state.classification && (
                <div className="mt-2">
                  <span className={`text-xs px-2 py-1 rounded font-medium ${
                    isUncontained
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}>
                    {state.classification.category}
                  </span>
                </div>
              )}
            </ChainOfThoughtStep>
          )}

          {!isUncontained && (
            <>
              <ChainOfThoughtStep
                icon={BrainIcon}
                label={
                  <span className="flex items-center gap-2">
                    Generate Clauses
                    <StepIcon currentStep={state.step} checkStep="clauses" hasClassification={hasClassification} />
                  </span>
                }
                description={
                  state.clauses
                    ? `${state.clauses.clauses.length} reasoning steps`
                    : "Analyzing question..."
                }
                status={getStepStatus(state.step, "clauses", hasClassification)}
              >
                {state.clauses && (
                  <div className="mt-2 space-y-1">
                    {state.clauses.clauses.map((clause, i) => (
                      <div
                        key={`clause-${i}`}
                        className="text-xs bg-muted px-2 py-1 rounded font-mono"
                      >
                        ({clause.node1}, {clause.relationship}, {clause.node2})
                      </div>
                    ))}
                  </div>
                )}
              </ChainOfThoughtStep>

              <ChainOfThoughtStep
                icon={NetworkIcon}
                label={
                  <span className="flex items-center gap-2">
                    Generate Knowledge Graph
                    <StepIcon currentStep={state.step} checkStep="graph" hasClassification={hasClassification} />
                  </span>
                }
                description={
                  state.graph
                    ? `${state.graph.triples.length} triples`
                    : "Building context..."
                }
                status={getStepStatus(state.step, "graph", hasClassification)}
              />
            </>
          )}

          <ChainOfThoughtStep
            icon={MessageSquareIcon}
            label={
              <span className="flex items-center gap-2">
                Generate Answer
                <StepIcon currentStep={state.step} checkStep="answer" hasClassification={hasClassification} />
              </span>
            }
            description={
              isUncontained
                ? (state.directAnswer?.answer ? "Answer ready" : "Generating...")
                : (state.answer?.answer ? "Answer ready" : "Reasoning...")
            }
            status={getStepStatus(state.step, "answer", hasClassification)}
          />
        </ChainOfThoughtContent>
      </ChainOfThought>

      {!isUncontained && state.graph && state.graph.triples.length > 0 && (
        <div className="h-[500px] w-full rounded-lg border bg-background overflow-hidden">
          {state.step === "graph" ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <div className="text-sm text-muted-foreground">
                Determining relevant subgraph...
              </div>
              <Progress
                value={(state.graph.triples.length / 25) * 100}
                className="w-64 h-2"
              />
              <div className="text-xs text-muted-foreground">
                {state.graph.triples.length} / 25 triples
              </div>
            </div>
          ) : (
            <ForceDirectedGraph
              triples={state.graph.triples}
              clauseNodes={clauseNodes}
              clauses={state.clauses?.clauses ?? []}
              isComplete={true}
            />
          )}
        </div>
      )}

      {!isUncontained && state.graph && state.graph.triples.length > 0 && (
        <details className="rounded-lg border bg-muted/30 p-2">
          <summary className="cursor-pointer text-xs text-muted-foreground font-medium px-2">
            View Raw Triples ({state.graph.triples.length})
          </summary>
          <div className="mt-2 max-h-[200px] overflow-y-auto space-y-1 px-2">
            {state.graph.triples.map((triple, i) => (
              <div
                key={`triple-${i}`}
                className="text-xs font-mono bg-background px-2 py-1 rounded flex items-center gap-2"
              >
                <span className="text-muted-foreground">[{(triple.score ?? 0).toFixed(2)}]</span>
                <span className={clauseNodes.has(triple.node1) ? "text-primary font-semibold" : ""}>
                  {triple.node1}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="text-muted-foreground">{triple.relationship}</span>
                <span className="text-muted-foreground">→</span>
                <span className={clauseNodes.has(triple.node2) ? "text-primary font-semibold" : ""}>
                  {triple.node2}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {!isUncontained && state.answer && (state.answer.answer || state.answer.reasoning) && (
        <div className="rounded-lg border bg-muted/50 p-4">
          {state.answer.answer && (
            <>
              <h4 className="font-medium mb-2">Answer</h4>
              <p className="text-sm">{state.answer.answer}</p>
            </>
          )}
          {state.answer.reasoning && (
            <>
              <h5 className="font-medium mt-3 mb-1 text-sm">Reasoning</h5>
              <p className="text-xs text-muted-foreground">
                {state.answer.reasoning}
              </p>
            </>
          )}
        </div>
      )}

      {isUncontained && state.directAnswer && (state.directAnswer.answer || state.directAnswer.reasoning) && (
        <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <div className="flex items-center gap-2 mb-3 text-xs text-red-600 dark:text-red-400">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Unsupported by selected documents</span>
          </div>
          {state.directAnswer.answer && (
            <>
              <h4 className="font-medium mb-2">Answer</h4>
              <p className="text-sm">{state.directAnswer.answer}</p>
            </>
          )}
          {state.directAnswer.reasoning && (
            <>
              <h5 className="font-medium mt-3 mb-1 text-sm">Reasoning</h5>
              <p className="text-xs text-muted-foreground">
                {state.directAnswer.reasoning}
              </p>
            </>
          )}
        </div>
      )}

      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          Error: {state.error}
        </div>
      )}
    </div>
  );
}
