export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  if (w <= max && h <= max) return { w, h };
  const scale = max / Math.max(w, h);
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

export function normalizeRect(r: Rect, imgW: number, imgH: number): Rect {
  const x = Math.max(0, Math.min(imgW, r.x));
  const y = Math.max(0, Math.min(imgH, r.y));
  const w = Math.max(1, Math.min(imgW - x, r.w));
  const h = Math.max(1, Math.min(imgH - y, r.h));
  return { x, y, w, h };
}

export function fullRect(w: number, h: number): Rect {
  return { x: 0, y: 0, w, h };
}