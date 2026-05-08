"use client";

import { ScatterplotCanvas } from "./scatterplot-canvas";

export function ScatterplotPanel() {
  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden border-b bg-background lg:border-r lg:border-b-0">
      <ScatterplotCanvas />
    </div>
  );
}
