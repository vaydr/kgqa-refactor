"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScatterPoint } from "../scatterplot-provider";
import type { Transform, Dimensions } from "./types";
import { transformCategory } from "@/lib/geometry";
import { type Matrix2x2, applyMatrix2x2 } from "@/lib/matrix";

interface CanvasCoreProps {
  points: ScatterPoint[];
  selectedPoints: ScatterPoint[];
  hoveredPoint: ScatterPoint | null;
  basisMatrix: Matrix2x2;
  inverseMatrix: Matrix2x2;
  isDark: boolean;
  selectMode: boolean;
  setHoveredPoint: (point: ScatterPoint | null) => void;
  togglePoint: (point: ScatterPoint) => void;
  clickPoint: (point: ScatterPoint) => void;
  selectPoint: (point: ScatterPoint) => void;
  clearSelection: () => void;
  onLastHoveredPointChange: (point: ScatterPoint) => void;
}

export function CanvasCore({
  points,
  selectedPoints,
  hoveredPoint,
  basisMatrix,
  inverseMatrix,
  isDark,
  selectMode,
  setHoveredPoint,
  togglePoint,
  clickPoint,
  selectPoint,
  clearSelection,
  onLastHoveredPointChange,
}: CanvasCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 0.5 });
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });

  // Track mouse state with refs to avoid stale closure issues
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const hasMoved = useRef(false);
  const isPanning = useRef(false);

  // Rectangle selection state
  const selectionStart = useRef<[number, number] | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const isSelecting = useRef(false);
  const selectionPreviewOpacity = useRef(0);
  const selectionAnimStartTime = useRef<number | null>(null);

  // Category hover state for opacity animation
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const categoryOpacitiesRef = useRef<Map<string, number>>(new Map());
  const drawCanvasRef = useRef<(() => void) | null>(null);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Transform screen coordinates to world coordinates
  const screenToWorld = useCallback((screenX: number, screenY: number): [number, number] => {
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const transformedX = (screenX - centerX - transform.x) / transform.scale;
    const transformedY = (screenY - centerY - transform.y) / transform.scale;
    return applyMatrix2x2(basisMatrix, [transformedX, transformedY]);
  }, [dimensions, transform, basisMatrix]);

  // Transform world coordinates to screen coordinates
  const worldToScreen = useCallback((worldX: number, worldY: number): [number, number] => {
    const [transformedX, transformedY] = applyMatrix2x2(inverseMatrix, [worldX, worldY]);
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const screenX = transformedX * transform.scale + centerX + transform.x;
    const screenY = transformedY * transform.scale + centerY + transform.y;
    return [screenX, screenY];
  }, [dimensions, transform, inverseMatrix]);

  // Compute category centroids for hit detection and rendering
  const categoryCentroids = useMemo(() => {
    const centroids = new Map<string, { x: number; y: number; color: [number, number, number, number] | null }>();
    const categoryData = new Map<string, { sumX: number; sumY: number; count: number; color: [number, number, number, number] | null }>();

    for (const point of points) {
      const category = point.metadata?.category;
      if (!category) continue;
      const data = categoryData.get(category) || { sumX: 0, sumY: 0, count: 0, color: point.color || null };
      data.sumX += point.position[0];
      data.sumY += point.position[1];
      data.count++;
      categoryData.set(category, data);
    }

    for (const [category, data] of categoryData) {
      centroids.set(category, {
        x: data.sumX / data.count,
        y: data.sumY / data.count,
        color: data.color,
      });
    }

    return centroids;
  }, [points]);

  // Animate category opacities when hovering over labels
  useEffect(() => {
    let animationId: number;

    const animate = () => {
      let needsUpdate = false;
      const opacities = categoryOpacitiesRef.current;

      for (const [category] of categoryCentroids) {
        const current = opacities.get(category) ?? 1;
        const target = hoveredCategory === null ? 1 : (hoveredCategory === category ? 1 : 0.3);
        const next = current + (target - current) * 0.15;

        if (Math.abs(next - target) > 0.01) {
          opacities.set(category, next);
          needsUpdate = true;
        } else if (current !== target) {
          opacities.set(category, target);
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        drawCanvasRef.current?.();
        animationId = requestAnimationFrame(animate);
      }
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [hoveredCategory, categoryCentroids]);

  // Animate selection preview fade effect
  useEffect(() => {
    if (!selectionRect) {
      selectionPreviewOpacity.current = 0;
      selectionAnimStartTime.current = null;
      return;
    }

    if (selectionAnimStartTime.current === null) {
      selectionAnimStartTime.current = performance.now();
    }

    let animationId: number;

    const animate = () => {
      const elapsed = performance.now() - selectionAnimStartTime.current!;
      selectionPreviewOpacity.current = 0.65 + 0.35 * Math.sin(elapsed * 0.004);
      drawCanvasRef.current?.();
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [selectionRect]);

  // Find point at position
  const findPointAtPosition = useCallback((screenX: number, screenY: number): ScatterPoint | null => {
    const [worldX, worldY] = screenToWorld(screenX, screenY);
    for (const point of points) {
      const dx = point.position[0] - worldX;
      const dy = point.position[1] - worldY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const hitRadius = (point.radius || 4) * 1.5 / transform.scale;
      if (distance < hitRadius) {
        return point;
      }
    }
    return null;
  }, [points, screenToWorld, transform.scale]);

  // Draw canvas
  useEffect(() => {
    const drawCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas || dimensions.width === 0) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = dimensions.width * dpr;
      canvas.height = dimensions.height * dpr;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Draw points
      for (const point of points) {
        const [screenX, screenY] = worldToScreen(point.position[0], point.position[1]);

        if (screenX < -50 || screenX > dimensions.width + 50 ||
            screenY < -50 || screenY > dimensions.height + 50) {
          continue;
        }

        const isSelected = selectedPoints.some(p => p.id === point.id);
        const isHovered = hoveredPoint?.id === point.id;

        let radius = (point.radius || 4) * transform.scale;
        radius = Math.max(2, Math.min(radius, 25));

        const categoryOpacity = categoryOpacitiesRef.current.get(point.metadata?.category || "") ?? 1;

        let fillColor: string;
        let strokeColor: string;

        if (point.color) {
          const [r, g, b] = point.color;
          fillColor = `rgba(${r}, ${g}, ${b}, ${categoryOpacity})`;
          strokeColor = `rgba(${Math.round(r * 0.7)}, ${Math.round(g * 0.7)}, ${Math.round(b * 0.7)}, ${categoryOpacity})`;
        } else {
          if (isDark) {
            fillColor = `rgba(140, 140, 160, ${0.7 * categoryOpacity})`;
            strokeColor = `rgba(100, 100, 120, ${0.3 * categoryOpacity})`;
          } else {
            fillColor = `rgba(180, 180, 195, ${0.8 * categoryOpacity})`;
            strokeColor = `rgba(100, 100, 120, ${0.3 * categoryOpacity})`;
          }
        }

        // Draw filled point
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();

        // Draw 0.5px stroke ring
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Selected point: white ring at radius+3, 1.5px solid stroke
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(screenX, screenY, radius + 3, 0, Math.PI * 2);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Hovered point (not selected): dashed ring + title label
        if (isHovered && !isSelected) {
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.arc(screenX, screenY, radius + 3, 0, Math.PI * 2);
          ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 1)" : "rgba(30, 30, 40, 1)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw point title to the right
          const title = point.metadata?.title;
          if (title) {
            ctx.font = "500 10px system-ui";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.85)" : "rgba(30, 30, 40, 0.9)";
            ctx.fillText(title, screenX + radius + 8, screenY);
          }
        }
      }

      // Draw fading preview rings for points inside selection rectangle
      if (selectionRect && selectionPreviewOpacity.current > 0) {
        const previewAlpha = selectionPreviewOpacity.current;
        const rx = Math.min(selectionRect.x, selectionRect.x + selectionRect.w);
        const ry = Math.min(selectionRect.y, selectionRect.y + selectionRect.h);
        const rw = Math.abs(selectionRect.w);
        const rh = Math.abs(selectionRect.h);
        for (const point of points) {
          const [screenX, screenY] = worldToScreen(point.position[0], point.position[1]);
          if (screenX >= rx && screenX <= rx + rw && screenY >= ry && screenY <= ry + rh) {
            const isSelected = selectedPoints.some(p => p.id === point.id);
            if (!isSelected) {
              let radius = (point.radius || 4) * transform.scale;
              radius = Math.max(2, Math.min(radius, 25));

              const [r, g, b] = point.color || [150, 150, 150];
              ctx.setLineDash([2, 3]);
              ctx.beginPath();
              ctx.arc(screenX, screenY, radius + 2, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${previewAlpha * 0.6})`;
              ctx.lineWidth = 1;
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        }
      }

      // Draw selection rectangle
      if (selectionRect) {
        ctx.setLineDash([5, 3]);
        ctx.strokeStyle = isDark ? "rgba(120, 200, 255, 0.6)" : "rgba(59, 130, 246, 0.6)";
        ctx.lineWidth = 1;
        ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
        ctx.setLineDash([]);

        ctx.fillStyle = isDark ? "rgba(120, 200, 255, 0.04)" : "rgba(59, 130, 246, 0.06)";
        ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
      }
    };

    drawCanvasRef.current = drawCanvas;
    drawCanvas();
  }, [points, hoveredPoint, selectedPoints, transform, dimensions, isDark, worldToScreen, selectionRect, categoryCentroids]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    hasMoved.current = false;

    if (selectMode || e.shiftKey) {
      isSelecting.current = true;
      selectionStart.current = [mouseX, mouseY];
      setSelectionRect({ x: mouseX, y: mouseY, w: 0, h: 0 });
    } else {
      isPanning.current = true;
    }
  }, [selectMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (mouseDownPos.current) {
      const dx = e.clientX - mouseDownPos.current.x;
      const dy = e.clientY - mouseDownPos.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved.current = true;
      }
    }

    if (isSelecting.current && selectionStart.current) {
      const [sx, sy] = selectionStart.current;
      setSelectionRect({ x: sx, y: sy, w: mouseX - sx, h: mouseY - sy });
    } else if (isPanning.current && mouseDownPos.current) {
      const dx = e.clientX - mouseDownPos.current.x;
      const dy = e.clientY - mouseDownPos.current.y;
      mouseDownPos.current = { x: e.clientX, y: e.clientY };
      setTransform(prev => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy,
      }));
    } else {
      const point = findPointAtPosition(mouseX, mouseY);
      setHoveredPoint(point);
      if (point) {
        onLastHoveredPointChange(point);
      }

      let foundCategory: string | null = null;
      for (const [category, centroid] of categoryCentroids) {
        const [screenX, screenY] = worldToScreen(centroid.x, centroid.y);
        const dx = mouseX - screenX;
        const dy = mouseY - screenY;
        if (Math.abs(dx) < 40 && Math.abs(dy) < 8) {
          foundCategory = category;
          break;
        }
      }
      setHoveredCategory(foundCategory);
    }
  }, [findPointAtPosition, setHoveredPoint, onLastHoveredPointChange, categoryCentroids, worldToScreen]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isSelecting.current && selectionRect && (Math.abs(selectionRect.w) > 5 || Math.abs(selectionRect.h) > 5)) {
      const selectedIds = new Set(selectedPoints.map(p => p.id));
      const rx = Math.min(selectionRect.x, selectionRect.x + selectionRect.w);
      const ry = Math.min(selectionRect.y, selectionRect.y + selectionRect.h);
      const rw = Math.abs(selectionRect.w);
      const rh = Math.abs(selectionRect.h);

      for (const point of points) {
        const [screenX, screenY] = worldToScreen(point.position[0], point.position[1]);
        if (screenX >= rx && screenX <= rx + rw && screenY >= ry && screenY <= ry + rh) {
          if (!selectedIds.has(point.id)) {
            selectPoint(point);
          }
        }
      }
      setSelectionRect(null);
      selectionStart.current = null;
    } else if (!hasMoved.current && !isSelecting.current) {
      const point = findPointAtPosition(mouseX, mouseY);
      if (point) {
        clickPoint(point);
      }
    }

    mouseDownPos.current = null;
    hasMoved.current = false;
    isPanning.current = false;
    isSelecting.current = false;
    selectionPreviewOpacity.current = 0;
  }, [selectionRect, points, selectedPoints, worldToScreen, selectPoint, findPointAtPosition, clickPoint]);

  const handleMouseLeave = useCallback(() => {
    mouseDownPos.current = null;
    hasMoved.current = false;
    isPanning.current = false;
    isSelecting.current = false;
    selectionPreviewOpacity.current = 0;
    selectionStart.current = null;
    setSelectionRect(null);
    setHoveredPoint(null);
  }, [setHoveredPoint]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(10, transform.scale * zoomFactor));

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    const mouseWorldX = (mouseX - centerX - transform.x) / transform.scale;
    const mouseWorldY = (mouseY - centerY - transform.y) / transform.scale;

    const newX = mouseX - centerX - mouseWorldX * newScale;
    const newY = mouseY - centerY - mouseWorldY * newScale;

    setTransform({ x: newX, y: newY, scale: newScale });
  }, [transform, dimensions]);

  const handleDoubleClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Determine cursor
  let cursor = "grab";
  if (selectMode) {
    cursor = "crosshair";
  } else if (isPanning.current) {
    cursor = "grabbing";
  } else if (hoveredPoint) {
    cursor = "pointer";
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          willChange: "transform",
          cursor,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
}
