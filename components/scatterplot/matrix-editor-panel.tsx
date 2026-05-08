"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Matrix2x2 } from "@/lib/matrix";

interface MatrixEditorPanelProps {
  basisMatrix: Matrix2x2;
  onMatrixChange: (matrix: Matrix2x2) => void;
  isDark: boolean;
}

export function MatrixEditorPanel({ basisMatrix, onMatrixChange, isDark }: MatrixEditorPanelProps) {
  const [matrixEditorOpen, setMatrixEditorOpen] = useState(false);
  const [draggingVector, setDraggingVector] = useState<"red" | "blue" | null>(null);
  const matrixCanvasRef = useRef<HTMLCanvasElement>(null);

  // Draw matrix editor canvas
  useEffect(() => {
    if (!matrixEditorOpen) return;

    const ctx = matrixCanvasRef.current?.getContext("2d");
    if (!ctx) return;

    const size = 120;
    const center = size / 2;
    const radius = 45;

    ctx.clearRect(0, 0, size, size);

    // Draw grid lines
    ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center, size);
    ctx.moveTo(0, center);
    ctx.lineTo(size, center);
    ctx.stroke();

    // Draw unit circle
    ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw red vector (first column: basisMatrix[0][0], basisMatrix[1][0])
    const [ax, ay] = [basisMatrix[0][0], basisMatrix[1][0]];
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(center + ax * radius, center - ay * radius);
    ctx.stroke();
    // Red endpoint
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(center + ax * radius, center - ay * radius, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw blue vector (second column: basisMatrix[0][1], basisMatrix[1][1])
    const [bx, by] = [basisMatrix[0][1], basisMatrix[1][1]];
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(center + bx * radius, center - by * radius);
    ctx.stroke();
    // Blue endpoint
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.arc(center + bx * radius, center - by * radius, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw center dot
    ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.arc(center, center, 2, 0, Math.PI * 2);
    ctx.fill();
  }, [matrixEditorOpen, basisMatrix, isDark]);

  // Matrix editor mouse handlers
  const handleMatrixMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const center = 60;
    const radius = 45;

    // Check if near red endpoint
    const redX = center + basisMatrix[0][0] * radius;
    const redY = center - basisMatrix[1][0] * radius;
    if (Math.hypot(x - redX, y - redY) < 12) {
      setDraggingVector("red");
      return;
    }

    // Check if near blue endpoint
    const blueX = center + basisMatrix[0][1] * radius;
    const blueY = center - basisMatrix[1][1] * radius;
    if (Math.hypot(x - blueX, y - blueY) < 12) {
      setDraggingVector("blue");
      return;
    }
  }, [basisMatrix]);

  const handleMatrixMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingVector) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const center = 60;

    // Calculate unit vector direction
    const dx = x - center;
    const dy = -(y - center); // flip y for math coords
    const len = Math.hypot(dx, dy);
    if (len < 1) return;

    const ux = dx / len;
    const uy = dy / len;

    const next: Matrix2x2 = [[basisMatrix[0][0], basisMatrix[0][1]], [basisMatrix[1][0], basisMatrix[1][1]]];
    if (draggingVector === "red") {
      next[0][0] = ux;
      next[1][0] = uy;
    } else {
      next[0][1] = ux;
      next[1][1] = uy;
    }
    onMatrixChange(next);
  }, [draggingVector, basisMatrix, onMatrixChange]);

  const handleMatrixMouseUp = useCallback(() => {
    setDraggingVector(null);
  }, []);

  return (
    <div
      className={`
        rounded-md backdrop-blur-sm overflow-hidden
        border transition-all duration-300 ease-out
        ${isDark
          ? "bg-black/70 border-white/[0.08]"
          : "bg-white/80 border-black/[0.08]"
        }
      `}
      style={{
        width: matrixEditorOpen ? "136px" : "auto",
      }}
    >
      <button
        onClick={() => setMatrixEditorOpen(!matrixEditorOpen)}
        className={`
          w-full px-2.5 py-1.5 flex justify-between items-center
          font-mono text-[9px] uppercase tracking-widest
          transition-colors
          ${isDark
            ? "text-slate-400 hover:bg-white/[0.04]"
            : "text-slate-500 hover:bg-black/[0.04]"
          }
        `}
      >
        <span>Basis</span>
        <span
          className={`text-[8px] transition-transform duration-300 ${isDark ? "text-slate-500" : "text-slate-400"}`}
          style={{ transform: matrixEditorOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▼
        </span>
      </button>
      <div
        className="transition-all duration-300 ease-out overflow-hidden"
        style={{
          maxHeight: matrixEditorOpen ? "200px" : "0px",
          opacity: matrixEditorOpen ? 1 : 0,
        }}
      >
        <div className="p-2 pt-0">
          <canvas
            ref={matrixCanvasRef}
            width={120}
            height={120}
            className="rounded cursor-pointer"
            style={{ background: "transparent" }}
            onMouseDown={handleMatrixMouseDown}
            onMouseMove={handleMatrixMouseMove}
            onMouseUp={handleMatrixMouseUp}
            onMouseLeave={handleMatrixMouseUp}
          />
          {/* 2x2 Matrix Display */}
          <div className="flex items-center justify-center mt-2 gap-1">
            <span className={`text-lg font-light ${isDark ? "text-slate-400" : "text-slate-500"}`}>[</span>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[11px]" style={{ fontVariantNumeric: "tabular-nums" }}>
              <span className="w-10 text-center" style={{ color: "#ef4444" }}>
                {basisMatrix[0][0].toFixed(2)}
              </span>
              <span className="w-10 text-center" style={{ color: "#3b82f6" }}>
                {basisMatrix[0][1].toFixed(2)}
              </span>
              <span className="w-10 text-center" style={{ color: "#ef4444" }}>
                {basisMatrix[1][0].toFixed(2)}
              </span>
              <span className="w-10 text-center" style={{ color: "#3b82f6" }}>
                {basisMatrix[1][1].toFixed(2)}
              </span>
            </div>
            <span className={`text-lg font-light ${isDark ? "text-slate-400" : "text-slate-500"}`}>]</span>
          </div>
        </div>
      </div>
    </div>
  );
}
