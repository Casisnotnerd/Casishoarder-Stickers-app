/**
 * How an artist's picture sits in its tile: which part of the photo is in view and how far it is zoomed.
 * x, y = centre of the visible area as a fraction (0–1) of the photo's width / height.
 * zoom = 1 when the photo just covers the tile; up to 4.
 */
export const TILE_ASPECT = 4 / 3;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export interface TileFrame { x: number; y: number; zoom: number }

export const DEFAULT_FRAME: TileFrame = { x: 0.5, y: 0.5, zoom: 1 };

const round4 = (n: number) => Number(n.toFixed(4));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Reads a saved framing: `frame:x,y,zoom`, or an old `"50% 20%"` position. Anything else → centred, zoom 1. */
export function parseFrame(s: string | null | undefined): TileFrame {
  if (!s) return { ...DEFAULT_FRAME };
  const f = /^frame:([\d.]+),([\d.]+),([\d.]+)$/.exec(s.trim());
  if (f) {
    const [x, y, zoom] = [Number(f[1]), Number(f[2]), Number(f[3])];
    if ([x, y, zoom].every(Number.isFinite)) return { x, y, zoom };
  }
  const p = /^([\d.]+)%\s+([\d.]+)%$/.exec(s.trim());
  if (p) return { x: Number(p[1]) / 100, y: Number(p[2]) / 100, zoom: 1 };
  return { ...DEFAULT_FRAME };
}

export function encodeFrame(f: TileFrame): string {
  return `frame:${round4(f.x)},${round4(f.y)},${round4(f.zoom)}`;
}

function size(zoom: number, imageAspect: number, tileAspect: number) {
  return {
    widthPct: zoom * Math.max(1, imageAspect / tileAspect) * 100,
    heightPct: zoom * Math.max(1, tileAspect / imageAspect) * 100,
  };
}

/** Keeps zoom in 1–4 and the centre far enough in that the photo always covers the whole tile. */
export function clampFrame(f: TileFrame, imageAspect: number, tileAspect = TILE_ASPECT): TileFrame {
  const zoom = clamp(Number.isFinite(f.zoom) ? f.zoom : 1, MIN_ZOOM, MAX_ZOOM);
  const { widthPct, heightPct } = size(zoom, imageAspect, tileAspect);
  const hx = 50 / widthPct, hy = 50 / heightPct; // half the visible fraction
  return {
    x: clamp(Number.isFinite(f.x) ? f.x : 0.5, hx, 1 - hx),
    y: clamp(Number.isFinite(f.y) ? f.y : 0.5, hy, 1 - hy),
    zoom,
  };
}

/** Size and offset of the photo, as % of the tile. */
export function frameLayout(f: TileFrame, imageAspect: number, tileAspect = TILE_ASPECT) {
  const c = clampFrame(f, imageAspect, tileAspect);
  const { widthPct, heightPct } = size(c.zoom, imageAspect, tileAspect);
  return { widthPct, heightPct, leftPct: 50 - c.x * widthPct, topPct: 50 - c.y * heightPct };
}

/** Dragging by (dx, dy) pixels moves the photo with the finger. */
export function panFrame(f: TileFrame, dxPx: number, dyPx: number, frameWidthPx: number, imageAspect: number, tileAspect = TILE_ASPECT): TileFrame {
  const c = clampFrame(f, imageAspect, tileAspect);
  const { widthPct, heightPct } = size(c.zoom, imageAspect, tileAspect);
  const photoW = (frameWidthPx * widthPct) / 100;
  const photoH = ((frameWidthPx / tileAspect) * heightPct) / 100;
  return clampFrame({ x: c.x - dxPx / photoW, y: c.y - dyPx / photoH, zoom: c.zoom }, imageAspect, tileAspect);
}

export function zoomFrame(f: TileFrame, zoom: number, imageAspect: number, tileAspect = TILE_ASPECT): TileFrame {
  return clampFrame({ ...f, zoom }, imageAspect, tileAspect);
}
