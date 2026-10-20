export interface Rect { x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function fitWithin(w: number, h: number, maxSide: number): { w: number; h: number } {
  const s = Math.min(1, maxSide / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

export function normalizeRect(a: Point, b: Point, maxW: number, maxH: number): Rect {
  const x1 = clamp(Math.min(a.x, b.x), 0, maxW), x2 = clamp(Math.max(a.x, b.x), 0, maxW);
  const y1 = clamp(Math.min(a.y, b.y), 0, maxH), y2 = clamp(Math.max(a.y, b.y), 0, maxH);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function fullRect(w: number, h: number): Rect {
  const mx = Math.round(w * 0.03), my = Math.round(h * 0.03);
  return { x: mx, y: my, w: w - 2 * mx, h: h - 2 * my };
}
