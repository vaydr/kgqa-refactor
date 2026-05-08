/**
 * Shared types for scatterplot components
 */

// Re-export ScatterPoint from provider for convenience
export type { ScatterPoint } from "../scatterplot-provider";

/**
 * Canvas transform state (pan + zoom)
 */
export interface Transform {
  x: number;
  y: number;
  scale: number;
}

/**
 * Dimensions of the canvas container
 */
export interface Dimensions {
  width: number;
  height: number;
}
