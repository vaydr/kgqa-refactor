import type { ScatterPoint } from "@/components/scatterplot-provider";

export function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

export function transformCategory(
  points: ScatterPoint[],
  category: string,
  a: number,
  b: number,
  c: number,
  d: number
): ScatterPoint[] {
  return points.map((p) => {
    if (p.metadata?.category !== category) return p;
    return {
      ...p,
      position: [p.position[0] * a + b, p.position[1] * c + d] as [number, number],
    };
  });
}
