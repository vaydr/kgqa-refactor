export type Matrix2x2 = [[number, number], [number, number]];

export function invertMatrix2x2(m: Matrix2x2): Matrix2x2 {
  const [[a, b], [c, d]] = m;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-10) {
    return [[1, 0], [0, 1]];
  }
  return [[d / det, -b / det], [-c / det, a / det]];
}

export function applyMatrix2x2(m: Matrix2x2, p: [number, number]): [number, number] {
  const [[a, b], [c, d]] = m;
  return [a * p[0] + b * p[1], c * p[0] + d * p[1]];
}
