"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

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

type GraphTriple = {
  node1: string;
  relationship: string;
  node2: string;
  score: number;
};

type ForceDirectedGraphProps = {
  triples: GraphTriple[];
  clauseNodes: Set<string>;
  clauses: Clause[];
  isComplete: boolean;
  neutralAccent?: boolean;
};

type GraphLayoutSignatureInput = {
  triples: GraphTriple[];
  clauseNodes: Set<string>;
  clauses: Clause[];
};

type BuildGraphLayoutStateInput = {
  triples: GraphTriple[];
  clauseNodes: Set<string>;
  reasoningEdgesMap: Map<string, { flipped: boolean }>;
  width: number;
  height: number;
  previousNodes?: GraphNode[];
};

type GraphLayoutState = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

const sortStrings = (values: Iterable<string>) => Array.from(values).sort();

const normalizeTriples = (triples: GraphTriple[]) =>
  triples
    .filter(
      (triple) =>
        triple?.node1 &&
        triple.node2 &&
        triple.relationship &&
        typeof triple.node1 === "string" &&
        typeof triple.node2 === "string"
    )
    .map((triple) => ({
      node1: triple.node1,
      relationship: triple.relationship,
      node2: triple.node2,
      score: triple.score ?? 0.5,
    }))
    .sort((a, b) =>
      `${a.node1}|${a.relationship}|${a.node2}`.localeCompare(
        `${b.node1}|${b.relationship}|${b.node2}`
      )
    );

const hashString = (value: string) => {
  let hash = 2_166_136_261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
};

const createSeededRandom = (seed: number) => {
  let current = seed >>> 0;

  return () => {
    current = (Math.imul(current, 1_664_525) + 1_013_904_223) >>> 0;
    return current / 4_294_967_296;
  };
};

export function getGraphLayoutSignature({
  triples,
  clauseNodes,
  clauses,
}: GraphLayoutSignatureInput) {
  return JSON.stringify({
    triples: normalizeTriples(triples),
    clauseNodes: sortStrings(clauseNodes),
    clauses: clauses
      .map((clause) => ({
        node1: clause.node1,
        relationship: clause.relationship,
        node2: clause.node2,
      }))
      .sort((a, b) =>
        `${a.node1}|${a.relationship}|${a.node2}`.localeCompare(
          `${b.node1}|${b.relationship}|${b.node2}`
        )
      ),
  });
}

const getSeededNodePosition = ({
  nodeId,
  index,
  total,
  width,
  height,
  signature,
}: {
  nodeId: string;
  index: number;
  total: number;
  width: number;
  height: number;
  signature: string;
}) => {
  const random = createSeededRandom(hashString(`${signature}|${nodeId}`));
  const centerX = width / 2;
  const centerY = height / 2;
  const safeWidth = Math.max(width, 320);
  const safeHeight = Math.max(height, 240);
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 + random() * 0.35;
  const radiusX = safeWidth * (0.16 + random() * 0.08);
  const radiusY = safeHeight * (0.12 + random() * 0.08);

  return {
    x: centerX + Math.cos(angle) * radiusX,
    y: centerY + Math.sin(angle) * radiusY,
  };
};

type SimulationEdge = {
  source: string;
  target: string;
  isReasoningPath: boolean;
};

export function runForceSimulation(
  initialNodes: GraphNode[],
  simulationEdges: SimulationEdge[],
  width: number,
  height: number,
  options: {
    pinnedPositions?: Map<string, { x: number; y: number }>;
    containmentX?: { min: number; max: number };
    containmentY?: { min: number; max: number };
    iterations?: number;
  } = {}
): GraphNode[] {
  const {
    pinnedPositions,
    containmentX,
    containmentY,
    iterations = 700,
  } = options;
  const nodes = initialNodes.map((node) => ({ ...node, vx: 0, vy: 0 }));
  if (nodes.length === 0) {
    return nodes;
  }

  if (pinnedPositions) {
    for (const node of nodes) {
      const anchor = pinnedPositions.get(node.id);
      if (anchor) {
        node.x = anchor.x;
        node.y = anchor.y;
      }
    }
  }

  const indexById = new Map(nodes.map((node, i) => [node.id, i] as const));
  const centerX = width / 2;
  const centerY = height / 2;
  const damping = 0.82;

  const BASE_REPULSION = 4800;
  const CLAUSE_REPULSION_MULTIPLIER = 2.4;
  const PINNED_REPULSION_MULTIPLIER = 5;
  const MIN_DIST_FROM_PIN = 90;
  const REASONING_EDGE_IDEAL_DIST = 200;
  const REGULAR_EDGE_IDEAL_DIST = 170;

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const iPinned = pinnedPositions?.has(nodes[i].id) ?? false;
        const jPinned = pinnedPositions?.has(nodes[j].id) ?? false;
        const oneSidedPin = iPinned !== jPinned;
        const bothClause = nodes[i].isClause && nodes[j].isClause;
        let repulsion = BASE_REPULSION;
        if (oneSidedPin) {
          repulsion *= PINNED_REPULSION_MULTIPLIER;
        } else if (bothClause) {
          repulsion *= CLAUSE_REPULSION_MULTIPLIER;
        }
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx -= fx;
        nodes[i].vy -= fy;
        nodes[j].vx += fx;
        nodes[j].vy += fy;
      }
    }

    // Attraction
    for (const edge of simulationEdges) {
      const sIdx = indexById.get(edge.source);
      const tIdx = indexById.get(edge.target);
      if (sIdx === undefined || tIdx === undefined) {
        continue;
      }
      const source = nodes[sIdx];
      const target = nodes[tIdx];
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const idealDist = edge.isReasoningPath
        ? REASONING_EDGE_IDEAL_DIST
        : REGULAR_EDGE_IDEAL_DIST;
      const force = (dist - idealDist) * 0.02;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }

    // Gravity
    for (const node of nodes) {
      node.vx += (centerX - node.x) * 0.01;
      node.vy += (centerY - node.y) * 0.01;
    }

    // Integrate
    for (const node of nodes) {
      const anchor = pinnedPositions?.get(node.id);
      if (anchor) {
        node.x = anchor.x;
        node.y = anchor.y;
        node.vx = 0;
        node.vy = 0;
        continue;
      }
      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx;
      node.y += node.vy;
      if (pinnedPositions) {
        for (const pinPos of pinnedPositions.values()) {
          const dxp = node.x - pinPos.x;
          const dyp = node.y - pinPos.y;
          const dp = Math.sqrt(dxp * dxp + dyp * dyp);
          if (dp < MIN_DIST_FROM_PIN) {
            const safe = dp > 0.001 ? dp : 1;
            const ux = dp > 0.001 ? dxp / safe : 1;
            const uy = dp > 0.001 ? dyp / safe : 0;
            node.x = pinPos.x + ux * MIN_DIST_FROM_PIN;
            node.y = pinPos.y + uy * MIN_DIST_FROM_PIN;
            node.vx = 0;
            node.vy = 0;
          }
        }
      }
      if (containmentX) {
        if (node.x < containmentX.min) {
          node.x = containmentX.min;
          node.vx = 0;
        } else if (node.x > containmentX.max) {
          node.x = containmentX.max;
          node.vx = 0;
        }
      }
      if (containmentY) {
        if (node.y < containmentY.min) {
          node.y = containmentY.min;
          node.vy = 0;
        } else if (node.y > containmentY.max) {
          node.y = containmentY.max;
          node.vy = 0;
        }
      }
    }
  }

  for (const node of nodes) {
    node.vx = 0;
    node.vy = 0;
  }
  return nodes;
}

export function buildGraphLayoutState({
  triples,
  clauseNodes,
  reasoningEdgesMap,
  width,
  height,
  previousNodes = [],
}: BuildGraphLayoutStateInput): GraphLayoutState {
  const completeTriples = normalizeTriples(triples);
  const signature = JSON.stringify({
    triples: completeTriples,
    clauseNodes: sortStrings(clauseNodes),
  });
  const previousNodeMap = new Map(
    previousNodes.map((node) => [node.id, node] as const)
  );
  const nodeIds = sortStrings(
    new Set(completeTriples.flatMap((triple) => [triple.node1, triple.node2]))
  );
  const nodes = nodeIds.map((nodeId, index) => {
    const previousNode = previousNodeMap.get(nodeId);

    if (previousNode) {
      return {
        ...previousNode,
        isClause: clauseNodes.has(nodeId),
      };
    }

    const seededPosition = getSeededNodePosition({
      nodeId,
      index,
      total: nodeIds.length,
      width,
      height,
      signature,
    });

    return {
      id: nodeId,
      x: seededPosition.x,
      y: seededPosition.y,
      vx: 0,
      vy: 0,
      isClause: clauseNodes.has(nodeId),
    };
  });

  const edges = completeTriples.map((triple) => {
    const edgeKey = `${triple.node1}|${triple.relationship}|${triple.node2}`;
    const reasoningInfo = reasoningEdgesMap.get(edgeKey);

    return {
      source: triple.node1,
      target: triple.node2,
      label: triple.relationship,
      score: triple.score,
      isReasoningPath: Boolean(reasoningInfo),
      isFlipped: reasoningInfo?.flipped ?? false,
    };
  });

  return { nodes, edges };
}

export function ForceDirectedGraph({
  triples,
  clauseNodes,
  clauses,
  isComplete,
  neutralAccent = false,
}: ForceDirectedGraphProps) {
  const accentStroke = neutralAccent ? "#9ca3af" : "#60a5fa";
  const accentLight = neutralAccent ? "#d1d5db" : "#93c5fd";
  const accentDark = neutralAccent ? "#4b5563" : "#1d4ed8";
  const accentMid = neutralAccent ? "#6b7280" : "#3b82f6";
  const accentBgRgba = neutralAccent
    ? "rgba(156, 163, 175, 0.25)"
    : "rgba(96, 165, 250, 0.25)";
  const accentMarkerId = neutralAccent
    ? "arrowhead-reasoning-gray"
    : "arrowhead-reasoning";
  const accentGradientId = neutralAccent
    ? "clause-gradient-gray"
    : "clause-gradient";

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const nodesRef = useRef<GraphNode[]>([]);

  const [containerSize, setContainerSize] = useState({
    width: 1000,
    height: 700,
  });
  const containerSizeRef = useRef(containerSize);

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  const [showHeatmap, setShowHeatmap] = useState(false);

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hasRevealed, setHasRevealed] = useState(false);
  const [hasSettled, setHasSettled] = useState(false);
  const initializedGraphSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    containerSizeRef.current = containerSize;
  }, [containerSize]);

  const getHeatmapColor = (score: number): string => {
    const clampedScore = Math.max(0, Math.min(1, score));
    if (clampedScore < 0.25) {
      const t = clampedScore / 0.25;
      return `rgb(${Math.round(59 + t * 0)}, ${Math.round(130 + t * 70)}, ${Math.round(246 - t * 46)})`;
    }
    if (clampedScore < 0.5) {
      const t = (clampedScore - 0.25) / 0.25;
      return `rgb(${Math.round(59 - t * 37)}, ${Math.round(200 + t * 55)}, ${Math.round(200 - t * 128)})`;
    }
    if (clampedScore < 0.75) {
      const t = (clampedScore - 0.5) / 0.25;
      return `rgb(${Math.round(22 + t * 212)}, ${Math.round(255 - t * 51)}, ${Math.round(72 - t * 72)})`;
    }
    const t = (clampedScore - 0.75) / 0.25;
    return `rgb(${Math.round(234 + t * 5)}, ${Math.round(204 - t * 154)}, ${Math.round(0)})`;
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

  const graphLayoutSignature = useMemo(
    () =>
      getGraphLayoutSignature({
        triples,
        clauseNodes,
        clauses,
      }),
    [triples, clauseNodes, clauses]
  );

  useEffect(() => {
    const isNewGraph =
      initializedGraphSignatureRef.current !== graphLayoutSignature;

    if (!isNewGraph) {
      return;
    }

    const layout = buildGraphLayoutState({
      triples,
      clauseNodes,
      reasoningEdgesMap,
      width: containerSize.width,
      height: containerSize.height,
      previousNodes: [],
    });

    initializedGraphSignatureRef.current = graphLayoutSignature;

    {
      setHasRevealed(false);
      setHasSettled(false);
      setTransform({ x: 0, y: 0, scale: 1 });

      const simWidth = Math.max(containerSize.width, 320);
      const simHeight = Math.max(containerSize.height, 240);

      const pathOrder: string[] = [];
      const seen = new Set<string>();
      for (const clause of clauses) {
        for (const id of [clause.node1, clause.node2]) {
          if (id && !seen.has(id)) {
            seen.add(id);
            pathOrder.push(id);
          }
        }
      }
      const existingIds = new Set(layout.nodes.map((node) => node.id));
      const visiblePath = pathOrder.filter((id) => existingIds.has(id));

      const pinnedPositions = new Map<string, { x: number; y: number }>();
      const sideMargin = simWidth * 0.05;
      const PATH_TILT_RANGE_DEG = 30;
      const SEGMENT_JITTER_DEG = 30;
      if (visiblePath.length > 0) {
        const usable = Math.max(simWidth - sideMargin * 2, 1);
        const segmentLength =
          visiblePath.length > 1 ? usable / (visiblePath.length - 1) : 0;
        const overallTiltRad =
          (((Math.random() - 0.5) * 2 * PATH_TILT_RANGE_DEG) * Math.PI) /
          180;

        const rawPositions: { x: number; y: number }[] = [];
        let x = 0;
        let y = 0;
        rawPositions.push({ x, y });
        for (let i = 1; i < visiblePath.length; i++) {
          const jitterRad =
            (((Math.random() - 0.5) * 2 * SEGMENT_JITTER_DEG) * Math.PI) / 180;
          const segmentAngle = overallTiltRad + jitterRad;
          x += Math.cos(segmentAngle) * segmentLength;
          y += Math.sin(segmentAngle) * segmentLength;
          rawPositions.push({ x, y });
        }

        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        for (const p of rawPositions) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        const offsetX = simWidth / 2 - (minX + maxX) / 2;
        const offsetY = simHeight / 2 - (minY + maxY) / 2;
        visiblePath.forEach((id, i) => {
          pinnedPositions.set(id, {
            x:
              visiblePath.length === 1
                ? simWidth / 2
                : rawPositions[i].x + offsetX,
            y:
              visiblePath.length === 1
                ? simHeight / 2
                : rawPositions[i].y + offsetY,
          });
        });
      }

      const containmentX = {
        min: sideMargin * 0.4,
        max: simWidth - sideMargin * 0.4,
      };
      const containmentY = {
        min: simHeight * 0.5 - simHeight * 0.42,
        max: simHeight * 0.5 + simHeight * 0.42,
      };
      const settledNodes = runForceSimulation(
        layout.nodes,
        layout.edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
          isReasoningPath: edge.isReasoningPath,
        })),
        simWidth,
        simHeight,
        { pinnedPositions, containmentX, containmentY }
      );

      setNodes(settledNodes);
      setEdges(layout.edges);
      setHasSettled(true);
    }
  }, [
    graphLayoutSignature,
    triples,
    clauseNodes,
    clauses,
    reasoningEdgesMap,
    containerSize.width,
    containerSize.height,
  ]);

  const resetView = useCallback(() => {
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
    const cw = rect.width;
    const ch = rect.height;

    const scaleX = cw / graphWidth;
    const scaleY = ch / graphHeight;
    const scale = Math.min(scaleX, scaleY, 1.2);

    const x = cw / 2 - graphCenterX * scale;
    const y = ch / 2 - graphCenterY * scale;

    setTransform({ x, y, scale });
  }, [nodes]);

  const [hasCentered, setHasCentered] = useState(false);
  useEffect(() => {
    setHasCentered(false);
  }, [graphLayoutSignature]);

  useEffect(() => {
    if (hasSettled && !hasCentered && nodes.length > 0) {
      resetView();
      setHasCentered(true);
    }
  }, [hasSettled, hasCentered, nodes.length, resetView]);

  useEffect(() => {
    if (!isComplete || !hasCentered || nodes.length === 0) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      setHasRevealed(true);
    });

    return () => cancelAnimationFrame(frame);
  }, [graphLayoutSignature, isComplete, hasCentered, nodes.length]);

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
      return isClause ? accentMid : "var(--muted)";
    }
    const avgScore = nodeAvgScores.get(nodeId) || 0.5;
    return getHeatmapColor(avgScore);
  };

  const getNodeRadius = (nodeId: string, isClause: boolean): number => {
    const baseMin = isClause ? 14 : 8;
    const baseMax = isClause ? 24 : 16;
    const score = nodeScores.get(nodeId) || 0;
    const normalized =
      maxScore > minScore ? (score - minScore) / (maxScore - minScore) : 0.5;
    return baseMin + normalized * (baseMax - baseMin);
  };

  const nodePositions = useMemo(() => {
    const map = new Map<
      string,
      { x: number; y: number; isClause: boolean; radius: number }
    >();
    nodes.forEach((n) =>
      map.set(n.id, {
        x: n.x,
        y: n.y,
        isClause: n.isClause,
        radius: getNodeRadius(n.id, n.isClause),
      })
    );
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
    if (hoveredNode || draggedNode) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    }

    if (draggedNode) {
      const graphPos = screenToGraph(e.clientX, e.clientY);
      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === draggedNode
            ? {
                ...node,
                x: graphPos.x - dragOffset.x,
                y: graphPos.y - dragOffset.y,
              }
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
    setHoveredNode(null);
  };

  const handleNodeMouseEnter = (e: React.MouseEvent, nodeId: string) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    setHoveredNode(nodeId);
  };

  const handleNodeMouseLeave = () => {
    setHoveredNode(null);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(
        Math.max(transform.scale * scaleFactor, 0.3),
        3
      );

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

  const getEdgeKey = (node1: string, rel: string, node2: string) =>
    `${node1}|${rel}|${node2}`;

  const truncateLabel = (label: string, max = 25): string => {
    if (label.length <= max) return label;
    return label.slice(0, max - 1) + "\u2026";
  };

  const activeNode = draggedNode ?? hoveredNode;

  return (
    <div className="flex h-full w-full select-none flex-col">
      {clauses.length > 0 &&
        (() => {
          type Item =
            | { kind: "node"; id: string }
            | {
                kind: "arrow";
                rel: string;
                node1: string;
                node2: string;
              }
            | { kind: "break" };

          const renderedEdgeKeys = new Set<string>();
          for (const edge of edges) {
            renderedEdgeKeys.add(getEdgeKey(edge.source, edge.label, edge.target));
            renderedEdgeKeys.add(getEdgeKey(edge.target, edge.label, edge.source));
          }
          const skipConnectivityCheck = renderedEdgeKeys.size === 0;

          const raw: Item[] = [];
          for (const clause of clauses) {
            const last = raw.at(-1);
            if (!last) {
              raw.push({ kind: "node", id: clause.node1 });
            } else if (last.kind !== "node" || last.id !== clause.node1) {
              raw.push({ kind: "break" });
              raw.push({ kind: "node", id: clause.node1 });
            }
            const connected =
              skipConnectivityCheck ||
              renderedEdgeKeys.has(
                getEdgeKey(clause.node1, clause.relationship, clause.node2)
              );
            raw.push(
              connected
                ? {
                    kind: "arrow",
                    rel: clause.relationship,
                    node1: clause.node1,
                    node2: clause.node2,
                  }
                : { kind: "break" }
            );
            raw.push({ kind: "node", id: clause.node2 });
          }

          const items: Item[] = [];
          for (const item of raw) {
            const prev = items.at(-1);
            if (item.kind === "break" && (!prev || prev.kind !== "node")) {
              continue;
            }
            items.push(item);
          }
          while (items.length && items.at(-1)?.kind !== "node") {
            items.pop();
          }

          return (
            <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 overflow-x-auto border-b border-border/40 bg-background/80 px-3 py-2 backdrop-blur-sm">
              <span className="mr-1 font-medium text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                Answer Path
              </span>
              {items.map((item, idx) => {
                if (item.kind === "node") {
                  return (
                    <span
                      className="whitespace-nowrap font-medium text-[11px] text-foreground/90"
                      key={`item-${idx}`}
                    >
                      {truncateLabel(item.id)}
                    </span>
                  );
                }
                if (item.kind === "break") {
                  return (
                    <span
                      className="mx-1 text-muted-foreground/50 text-[12px]"
                      key={`item-${idx}`}
                    >
                      |
                    </span>
                  );
                }
                const edgeKey = getEdgeKey(item.node1, item.rel, item.node2);
                const isHovered = hoveredEdge === edgeKey;
                return (
                  <button
                    className="flex flex-col items-center px-1 leading-tight transition-transform"
                    key={`item-${idx}`}
                    onMouseEnter={() => setHoveredEdge(edgeKey)}
                    onMouseLeave={() => setHoveredEdge(null)}
                    style={{
                      transform: isHovered ? "scale(1.08)" : "scale(1)",
                    }}
                    type="button"
                  >
                    <span
                      className="font-medium text-[10px]"
                      style={{ color: accentMid }}
                    >
                      {item.rel}
                    </span>
                    <span
                      className="text-[12px]"
                      style={{ color: accentStroke }}
                    >
                      →
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })()}

      <div
        className="relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        ref={containerRef}
      >
        {activeNode && (
          <div
            className="pointer-events-none absolute z-50"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y - 36,
              transform: "translateX(-50%)",
            }}
          >
            <div
              className="whitespace-nowrap rounded px-2.5 py-1.5 text-white text-xs"
              style={{
                background: "rgba(15, 15, 15, 0.92)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                maxWidth: 400,
              }}
            >
              {activeNode}
            </div>
          </div>
        )}

        <ButtonGroup className="absolute right-3 bottom-3 z-10">
          <Button
            className="h-7 px-2 text-[10px] text-muted-foreground"
            onClick={() => setShowHeatmap((prev) => !prev)}
            size="sm"
            variant={showHeatmap ? "default" : "ghost"}
          >
            Heatmap
          </Button>
          <Button
            className="h-7 px-2 text-[10px] text-muted-foreground"
            onClick={() =>
              setTransform((prev) => ({
                ...prev,
                scale: Math.min(prev.scale * 1.2, 3),
              }))
            }
            size="sm"
            variant="ghost"
          >
            +
          </Button>
          <Button
            className="h-7 px-2 text-[10px] text-muted-foreground"
            onClick={() =>
              setTransform((prev) => ({
                ...prev,
                scale: Math.max(prev.scale * 0.8, 0.3),
              }))
            }
            size="sm"
            variant="ghost"
          >
            &minus;
          </Button>
          <Button
            className="h-7 px-2 text-[10px] text-muted-foreground"
            onClick={resetView}
            size="sm"
            variant="ghost"
          >
            Reset
          </Button>
        </ButtonGroup>

        {showHeatmap && (
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded border bg-background/90 px-2 py-1 text-[10px]">
            <span className="text-muted-foreground">0</span>
            <span
              className="h-1.5 w-20 rounded-full"
              style={{
                background:
                  "linear-gradient(to right, #3b82f6, #22d3ee, #22c55e, #eab308, #ef4444)",
              }}
            />
            <span className="text-muted-foreground">1</span>
          </div>
        )}

        <svg
          height="100%"
          ref={svgRef}
          style={{
            userSelect: "none",
            opacity: hasRevealed ? 1 : 0,
            transform: hasRevealed ? "scale(1)" : "scale(0.985)",
            transformOrigin: "50% 50%",
            transition:
              "opacity 400ms ease-out, transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
          width="100%"
        >
          <defs>
            <pattern
              height="20"
              id="dot-grid"
              patternUnits="userSpaceOnUse"
              width="20"
              x="0"
              y="0"
            >
              <circle
                cx="10"
                cy="10"
                fill="var(--foreground)"
                opacity="0.15"
                r="0.5"
              />
            </pattern>

            <filter height="200%" id="glow" width="200%" x="-50%" y="-50%">
              <feGaussianBlur
                in="SourceGraphic"
                result="blur"
                stdDeviation="4"
              />
              <feMerge>
                <feMergeNode in="blur" />
              </feMerge>
            </filter>

            <radialGradient cx="35%" cy="35%" id="clause-gradient" r="65%">
              <stop offset="0%" stopColor="#93c5fd" />
              <stop offset="100%" stopColor="#2563eb" />
            </radialGradient>
            <radialGradient cx="35%" cy="35%" id="clause-gradient-gray" r="65%">
              <stop offset="0%" stopColor="#d1d5db" />
              <stop offset="100%" stopColor="#4b5563" />
            </radialGradient>

            <marker
              id="arrowhead-normal"
              markerHeight="4"
              markerWidth="5"
              orient="auto"
              refX="5"
              refY="2"
            >
              <path
                d="M0,0.5 L4,2 L0,3.5"
                fill="none"
                stroke="var(--muted-foreground)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1"
              />
            </marker>
            <marker
              id="arrowhead-reasoning"
              markerHeight="5"
              markerWidth="6"
              orient="auto"
              refX="6"
              refY="2.5"
            >
              <path
                d="M0,0.5 L5,2.5 L0,4.5"
                fill="none"
                stroke="#60a5fa"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.2"
              />
            </marker>
            <marker
              id="arrowhead-reasoning-gray"
              markerHeight="5"
              markerWidth="6"
              orient="auto"
              refX="6"
              refY="2.5"
            >
              <path
                d="M0,0.5 L5,2.5 L0,4.5"
                fill="none"
                stroke="#9ca3af"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.2"
              />
            </marker>
            <marker
              id="arrowhead-normal-hover"
              markerHeight="5"
              markerWidth="6"
              orient="auto"
              refX="6"
              refY="2.5"
            >
              <path
                d="M0,0.5 L5,2.5 L0,4.5"
                fill="none"
                stroke="var(--foreground)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.2"
              />
            </marker>
            <marker
              id="arrowhead-heatmap"
              markerHeight="4"
              markerWidth="5"
              orient="auto"
              refX="5"
              refY="2"
            >
              <path
                d="M0,0.5 L4,2 L0,3.5"
                fill="none"
                stroke="context-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1"
              />
            </marker>
          </defs>

          <rect fill="var(--background)" height="100%" width="100%" />
          <rect fill="url(#dot-grid)" height="100%" width="100%" />

          <g
            transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
          >
            {edges
              .sort(
                (a, b) =>
                  (a.isReasoningPath ? 1 : 0) - (b.isReasoningPath ? 1 : 0)
              )
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

                const isReasoning = edge.isReasoningPath;
                const strokeW = isReasoning ? 2.5 : 1.2;
                const markerRefXUnits = isReasoning ? 6 : 5;
                const markerOverhang = markerRefXUnits * strokeW;

                const sourceRadius = actualSource.radius;
                const targetRadius = actualTarget.radius + markerOverhang;
                const x1 = actualSource.x + (dx / dist) * sourceRadius;
                const y1 = actualSource.y + (dy / dist) * sourceRadius;
                const x2 = actualTarget.x - (dx / dist) * targetRadius;
                const y2 = actualTarget.y - (dy / dist) * targetRadius;

                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                const edgeKey = getEdgeKey(
                  edge.source,
                  edge.label,
                  edge.target
                );
                const isHovered = hoveredEdge === edgeKey;

                return (
                  <g
                    key={`edge-${i}`}
                    onMouseEnter={() => isReasoning && setHoveredEdge(edgeKey)}
                    onMouseLeave={() => setHoveredEdge(null)}
                  >
                    {isReasoning && (
                      <line
                        filter="url(#glow)"
                        opacity={isHovered ? 0.5 : 0.2}
                        stroke={accentStroke}
                        strokeWidth={8}
                        x1={x1}
                        x2={x2}
                        y1={y1}
                        y2={y2}
                      />
                    )}
                    <line
                      markerEnd={
                        showHeatmap
                          ? "url(#arrowhead-heatmap)"
                          : isReasoning
                            ? `url(#${accentMarkerId})`
                            : "url(#arrowhead-normal)"
                      }
                      opacity={showHeatmap ? 0.85 : isReasoning ? 1 : 0.45}
                      stroke={
                        showHeatmap
                          ? getHeatmapColor(edge.score)
                          : isReasoning
                            ? isHovered
                              ? accentLight
                              : accentStroke
                            : "var(--muted-foreground)"
                      }
                      strokeLinecap="round"
                      strokeWidth={isReasoning ? 2.5 : showHeatmap ? 2 : 1.2}
                      x1={x1}
                      x2={x2}
                      y1={y1}
                      y2={y2}
                    />
                    {!isReasoning && (
                      <>
                        <rect
                          fill="var(--background)"
                          height={18}
                          opacity={0.9}
                          rx={4}
                          width={edge.label.length * 7.5 + 10}
                          x={midX - (edge.label.length * 7.5 + 10) / 2}
                          y={midY - 9}
                        />
                        <text
                          fill="var(--muted-foreground)"
                          fontSize="13"
                          fontWeight="500"
                          opacity="0.85"
                          style={{ pointerEvents: "none" }}
                          textAnchor="middle"
                          x={midX}
                          y={midY + 4}
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
              const isHovered = activeNode === node.id;
              return (
                <g
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onMouseEnter={(e) => handleNodeMouseEnter(e, node.id)}
                  onMouseLeave={handleNodeMouseLeave}
                  style={{ cursor: isDragging ? "grabbing" : "grab" }}
                >
                  {isDragging && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      fill="none"
                      opacity={0.4}
                      r={radius + 4}
                      stroke="var(--primary)"
                      strokeWidth={1.5}
                    />
                  )}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    fill={
                      showHeatmap
                        ? getNodeColor(node.id, node.isClause)
                        : node.isClause
                          ? `url(#${accentGradientId})`
                          : "var(--muted)"
                    }
                    opacity={isHovered ? 1 : node.isClause ? 0.95 : 0.8}
                    r={radius}
                    stroke={
                      showHeatmap
                        ? "var(--border)"
                        : node.isClause
                          ? accentDark
                          : "var(--border)"
                    }
                    strokeWidth={1}
                  />
                  <text
                    fill={
                      showHeatmap
                        ? getNodeColor(node.id, node.isClause)
                        : node.isClause
                          ? accentLight
                          : "var(--foreground)"
                    }
                    fontSize="11"
                    fontWeight={node.isClause ? "600" : "400"}
                    opacity={0.9}
                    style={{
                      pointerEvents: "none",
                      textShadow:
                        "0 0 4px var(--background), 0 0 4px var(--background), 0 0 4px var(--background)",
                    }}
                    textAnchor="middle"
                    x={node.x}
                    y={node.y + radius + 14}
                  >
                    {truncateLabel(node.id)}
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

                const sourceRadius = actualSource.radius;
                const targetRadius = actualTarget.radius;
                const x1 = actualSource.x + (dx / dist) * sourceRadius;
                const y1 = actualSource.y + (dy / dist) * sourceRadius;
                const x2 = actualTarget.x - (dx / dist) * targetRadius;
                const y2 = actualTarget.y - (dy / dist) * targetRadius;

                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                const edgeKey = getEdgeKey(
                  edge.source,
                  edge.label,
                  edge.target
                );
                const isHovered = hoveredEdge === edgeKey;

                const labelPadding = 6;
                const labelWidth = edge.label.length * 7.5 + labelPadding * 2;
                const labelHeight = 20;

                const labelColor = showHeatmap
                  ? getHeatmapColor(edge.score)
                  : undefined;

                return (
                  <g
                    key={`clause-label-${i}`}
                    onMouseEnter={() => setHoveredEdge(edgeKey)}
                    onMouseLeave={() => setHoveredEdge(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      fill={
                        labelColor ||
                        (isHovered
                          ? "rgba(30, 30, 30, 0.85)"
                          : "rgba(20, 20, 20, 0.7)")
                      }
                      height={labelHeight}
                      rx="7"
                      stroke={labelColor ? "none" : accentBgRgba}
                      strokeWidth={0.5}
                      style={{ transition: "fill 0.15s" }}
                      width={labelWidth}
                      x={midX - labelWidth / 2}
                      y={midY - labelHeight / 2}
                    />
                    <text
                      fill={labelColor ? "white" : accentLight}
                      fontSize="13"
                      fontWeight="600"
                      style={{ pointerEvents: "none" }}
                      textAnchor="middle"
                      x={midX}
                      y={midY + 4}
                    >
                      {edge.label}
                    </text>
                  </g>
                );
              })}

            {(() => {
              let ringIds: Set<string> | null = null;
              let incidentEdges: typeof edges = [];
              if (activeNode) {
                incidentEdges = edges.filter(
                  (edge) =>
                    edge.source === activeNode || edge.target === activeNode
                );
                ringIds = new Set<string>([activeNode]);
                for (const edge of incidentEdges) {
                  ringIds.add(edge.source);
                  ringIds.add(edge.target);
                }
              } else if (hoveredEdge) {
                const matched = edges.find(
                  (edge) =>
                    getEdgeKey(edge.source, edge.label, edge.target) ===
                    hoveredEdge
                );
                if (matched) {
                  incidentEdges = [matched];
                  ringIds = new Set<string>([matched.source, matched.target]);
                }
              }
              if (!ringIds) {
                return null;
              }
              return (
                  <g style={{ pointerEvents: "none" }}>
                    {incidentEdges.map((edge, i) => {
                      const actualSource = edge.isFlipped
                        ? nodePositions.get(edge.target)
                        : nodePositions.get(edge.source);
                      const actualTarget = edge.isFlipped
                        ? nodePositions.get(edge.source)
                        : nodePositions.get(edge.target);
                      if (!(actualSource && actualTarget)) {
                        return null;
                      }

                      const dx = actualTarget.x - actualSource.x;
                      const dy = actualTarget.y - actualSource.y;
                      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                      const isReasoning = edge.isReasoningPath;
                      const strokeW = isReasoning ? 3 : 2;
                      const markerRefXUnits = isReasoning ? 6 : 5;
                      const markerOverhang = markerRefXUnits * strokeW;
                      const sourceRadius = actualSource.radius;
                      const targetRadius = actualTarget.radius + markerOverhang;
                      const x1 = actualSource.x + (dx / dist) * sourceRadius;
                      const y1 = actualSource.y + (dy / dist) * sourceRadius;
                      const x2 = actualTarget.x - (dx / dist) * targetRadius;
                      const y2 = actualTarget.y - (dy / dist) * targetRadius;

                      return (
                        <line
                          key={`hover-edge-${i}`}
                          markerEnd={
                            showHeatmap
                              ? "url(#arrowhead-heatmap)"
                              : isReasoning
                                ? `url(#${accentMarkerId})`
                                : "url(#arrowhead-normal-hover)"
                          }
                          opacity={1}
                          stroke={
                            showHeatmap
                              ? getHeatmapColor(edge.score)
                              : isReasoning
                                ? accentStroke
                                : "var(--foreground)"
                          }
                          strokeLinecap="round"
                          strokeWidth={strokeW}
                          x1={x1}
                          x2={x2}
                          y1={y1}
                          y2={y2}
                        />
                      );
                    })}

                    {Array.from(ringIds).map((id) => {
                      const pos = nodePositions.get(id);
                      if (!pos) {
                        return null;
                      }
                      return (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          fill="none"
                          key={`hover-ring-${id}`}
                          r={pos.radius + 3}
                          stroke="var(--foreground)"
                          strokeWidth={2}
                        />
                      );
                    })}

                    {Array.from(ringIds).map((id) => {
                      const pos = nodePositions.get(id);
                      if (!pos) {
                        return null;
                      }
                      const label = truncateLabel(id);
                      const labelPadding = 6;
                      const labelWidth = label.length * 7 + labelPadding * 2;
                      const labelHeight = 18;
                      const labelY = pos.y + pos.radius + 14;
                      const onPath = pos.isClause;
                      return (
                        <g key={`hover-node-label-${id}`}>
                          <rect
                            fill={onPath ? accentStroke : "var(--foreground)"}
                            height={labelHeight}
                            rx={5}
                            width={labelWidth}
                            x={pos.x - labelWidth / 2}
                            y={labelY - labelHeight / 2 - 1}
                          />
                          <text
                            fill={onPath ? "white" : "var(--background)"}
                            fontSize="12"
                            fontWeight="700"
                            textAnchor="middle"
                            x={pos.x}
                            y={labelY + 3}
                          >
                            {label}
                          </text>
                        </g>
                      );
                    })}

                    {incidentEdges.map((edge, i) => {
                      const actualSource = edge.isFlipped
                        ? nodePositions.get(edge.target)
                        : nodePositions.get(edge.source);
                      const actualTarget = edge.isFlipped
                        ? nodePositions.get(edge.source)
                        : nodePositions.get(edge.target);
                      if (!(actualSource && actualTarget)) {
                        return null;
                      }

                      const dx = actualTarget.x - actualSource.x;
                      const dy = actualTarget.y - actualSource.y;
                      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                      const sourceRadius = actualSource.radius;
                      const targetRadius = actualTarget.radius;
                      const x1 = actualSource.x + (dx / dist) * sourceRadius;
                      const y1 = actualSource.y + (dy / dist) * sourceRadius;
                      const x2 = actualTarget.x - (dx / dist) * targetRadius;
                      const y2 = actualTarget.y - (dy / dist) * targetRadius;
                      const midX = (x1 + x2) / 2;
                      const midY = (y1 + y2) / 2;

                      const labelPadding = 8;
                      const labelWidth = edge.label.length * 7.5 + labelPadding * 2;
                      const labelHeight = 22;

                      const isReasoningLabel = edge.isReasoningPath;
                      return (
                        <g key={`hover-label-${i}`}>
                          <rect
                            fill={
                              isReasoningLabel
                                ? accentStroke
                                : "var(--foreground)"
                            }
                            height={labelHeight}
                            rx={7}
                            width={labelWidth}
                            x={midX - labelWidth / 2}
                            y={midY - labelHeight / 2}
                          />
                          <text
                            fill={isReasoningLabel ? "white" : "var(--background)"}
                            fontSize="13"
                            fontWeight="600"
                            textAnchor="middle"
                            x={midX}
                            y={midY + 4}
                          >
                            {edge.label}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })()}
          </g>
        </svg>
      </div>
    </div>
  );
}
