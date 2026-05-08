"use client";

import { type ReactNode, useRef, useState, useEffect } from "react";

interface LimelightNavItem {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

interface LimelightNavProps {
  items: LimelightNavItem[];
  activeIndex: number;
  className?: string;
  isDark?: boolean;
}

export function LimelightNav({ items, activeIndex, className = "", isDark = false }: LimelightNavProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightStyle, setHighlightStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const buttons = containerRef.current.querySelectorAll("button");
    const activeButton = buttons[activeIndex];
    if (activeButton) {
      setHighlightStyle({
        left: activeButton.offsetLeft,
        width: activeButton.offsetWidth,
      });
    }
  }, [activeIndex]);

  return (
    <div
      ref={containerRef}
      className={`
        relative flex items-center gap-0.5 p-1 rounded-lg backdrop-blur-md
        border transition-all duration-300
        ${isDark
          ? "bg-slate-900/90 border-cyan-500/30"
          : "bg-white/90 border-slate-300"
        }
        ${className}
      `}
      style={{
        boxShadow: isDark
          ? "0 0 20px rgba(99, 255, 255, 0.2)"
          : "0 4px 12px rgba(0, 0, 0, 0.15)",
      }}
    >
      {/* Animated highlight */}
      <div
        className={`
          absolute top-1 h-[calc(100%-8px)] rounded-md
          transition-all duration-200 ease-out
          ${isDark ? "bg-cyan-500/20" : "bg-slate-200"}
        `}
        style={{
          left: highlightStyle.left,
          width: highlightStyle.width,
        }}
      />

      {items.map((item, index) => (
        <button
          key={item.label}
          onClick={item.onClick}
          className={`
            relative z-10 p-1.5 rounded-md transition-colors duration-200
            ${index === activeIndex
              ? isDark
                ? "text-cyan-400"
                : "text-slate-900"
              : isDark
                ? "text-slate-500 hover:text-slate-300"
                : "text-slate-400 hover:text-slate-600"
            }
          `}
          title={item.label}
          aria-label={item.label}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}
