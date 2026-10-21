import { fitWithin, type Rect } from './geometry';

/**
 * Finds sticker sheets lying on a plain background in one photo.
 *
 * Works on a small copy of the photo: takes the most common edge colour as the background
 * (the table), marks every pixel that differs clearly from it, fills holes, then takes the bounding box of each large connected blob. Best results come from
 * sheets on a plain, contrasting background with a small gap between sheets.
 * The user always reviews and can fix the boxes afterwards.
 */

export const DETECT_SIDE = 480; // working size (long side) for detection
export const MAX_SHEETS = 16;

/** rgba: RGBA pixel data of a w×h image. Returns boxes in the same pixel coordinates, in reading order. */
export function detectSheets(rgba: Uint8ClampedArray, w: number, h: number): Rect[] {
  const n = w * h;
  if (n === 0) return [];

  // 1. Background colour = the most common colour around the photo's edges (the table),
  //    averaged within its colour bucket.
  const frame = Math.max(1, Math.round(Math.min(w, h) * 0.12));
  const inFrame = (p: number) => {
    const x = p % w, y = (p - x) / w;
    return x < frame || y < frame || x >= w - frame || y >= h - frame;
  };
  const counts = new Map<number, number>();
  for (let p = 0; p < n; p++) {
    if (!inFrame(p)) continue;
    const i = p * 4;
    const k = ((rgba[i] >> 4) << 8) | ((rgba[i + 1] >> 4) << 4) | (rgba[i + 2] >> 4);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let bgKey = 0, bgCount = -1;
  for (const [k, c] of counts) if (c > bgCount) { bgKey = k; bgCount = c; }
  const bg = [0, 0, 0];
  for (let p = 0; p < n; p++) {
    if (!inFrame(p)) continue;
    const i = p * 4;
    if ((((rgba[i] >> 4) << 8) | ((rgba[i + 1] >> 4) << 4) | (rgba[i + 2] >> 4)) !== bgKey) continue;
    bg[0] += rgba[i]; bg[1] += rgba[i + 1]; bg[2] += rgba[i + 2];
  }
  for (let c = 0; c < 3; c++) bg[c] /= bgCount;

  // 2. Distance from background, thresholded with Otsu, kept between 30 and 48.
  const dist = new Uint8Array(n);
  const hist = new Array<number>(256).fill(0);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const d = Math.round(Math.max(Math.abs(rgba[i] - bg[0]), Math.abs(rgba[i + 1] - bg[1]), Math.abs(rgba[i + 2] - bg[2])));
    dist[p] = d;
    hist[d]++;
  }
  const threshold = Math.min(48, Math.max(30, otsu(hist, n)));
  let mask: Uint8Array = new Uint8Array(n);
  for (let p = 0; p < n; p++) mask[p] = dist[p] >= threshold ? 1 : 0;

  // 3. Remove specks, then fill holes inside each sheet (dark artwork, shadows).
  mask = dilate(erode(mask, w, h, 1), w, h, 1);
  mask = fillHoles(mask, w, h);

  // 4. Connected blobs → boxes.
  const boxes = components(mask, w, h)
    .filter((c) => {
      const area = c.w * c.h;
      return area >= n * 0.012 && c.w >= w * 0.05 && c.h >= h * 0.05 && area <= n * 0.92 && c.count / area >= 0.3;
    });

  // 5. Drop boxes inside another box, keep the largest MAX_SHEETS, pad slightly.
  const outer = boxes.filter((b) => !boxes.some((o) => o !== b && contains(o, b)));
  outer.sort((a, b) => b.w * b.h - a.w * a.h);
  const pad = Math.round(Math.max(w, h) * 0.01);
  const kept = outer.slice(0, MAX_SHEETS).map((b) => clampRect({ x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad }, w, h));
  return readingOrder(kept);
}

/** Runs detection on a photo and returns boxes in the photo's own pixel coordinates. */
export function detectSheetsInImage(img: CanvasImageSource & { width: number; height: number }): Rect[] {
  const { w, h } = fitWithin(img.width, img.height, DETECT_SIDE);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, w, h);
  const boxes = detectSheets(ctx.getImageData(0, 0, w, h).data, w, h);
  const sx = img.width / w, sy = img.height / h;
  return boxes.map((b) => ({ x: Math.round(b.x * sx), y: Math.round(b.y * sy), w: Math.round(b.w * sx), h: Math.round(b.h * sy) }));
}

/** Sorts boxes row by row (top to bottom), left to right within a row. */
export function readingOrder(boxes: Rect[]): Rect[] {
  const byTop = [...boxes].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const rows: Rect[][] = [];
  for (const b of byTop) {
    const cy = b.y + b.h / 2;
    const row = rows.find((rw) => {
      const ref = rw[0];
      return Math.abs(cy - (ref.y + ref.h / 2)) < Math.min(ref.h, b.h) / 2;
    });
    if (row) row.push(b); else rows.push([b]);
  }
  return rows.flatMap((rw) => rw.sort((a, b) => a.x - b.x));
}

function otsu(hist: number[], total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, bestT = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; bestT = t + 1; }
  }
  return bestT;
}

function dilate(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  return morph(m, w, h, r, 1);
}
function erode(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  return morph(m, w, h, r, 0);
}
/** Square-window morphology as two 1-D passes. target=1 dilates, target=0 erodes. */
function morph(m: Uint8Array, w: number, h: number, r: number, target: 0 | 1): Uint8Array {
  const tmp = new Uint8Array(m.length);
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 1 - target;
      for (let k = -r; k <= r && v !== target; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < w && m[y * w + xx] === target) v = target;
      }
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 1 - target;
      for (let k = -r; k <= r && v !== target; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < h && tmp[yy * w + x] === target) v = target;
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

/** Background pixels not reachable from the photo's edge are holes inside a sheet: fill them. */
function fillHoles(m: Uint8Array, w: number, h: number): Uint8Array {
  const outside = new Uint8Array(m.length);
  const stack: number[] = [];
  const push = (p: number) => { if (!m[p] && !outside[p]) { outside[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < m.length - w) push(p + w);
  }
  const out = new Uint8Array(m.length);
  for (let p = 0; p < m.length; p++) out[p] = outside[p] ? 0 : 1;
  return out;
}

interface Blob4 extends Rect { count: number }

function components(m: Uint8Array, w: number, h: number): Blob4[] {
  const seen = new Uint8Array(m.length);
  const out: Blob4[] = [];
  const stack: number[] = [];
  for (let start = 0; start < m.length; start++) {
    if (!m[start] || seen[start]) continue;
    let x1 = w, y1 = h, x2 = -1, y2 = -1, count = 0;
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w, y = (p - x) / w;
      count++;
      if (x < x1) x1 = x; if (x > x2) x2 = x;
      if (y < y1) y1 = y; if (y > y2) y2 = y;
      if (x > 0 && m[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && m[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && m[p - w] && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
      if (y < h - 1 && m[p + w] && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
    }
    out.push({ x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1, count });
  }
  return out;
}

function contains(o: Rect, b: Rect): boolean {
  return b.x >= o.x && b.y >= o.y && b.x + b.w <= o.x + o.w && b.y + b.h <= o.y + o.h;
}

export function clampRect(r: Rect, maxW: number, maxH: number): Rect {
  const x = Math.max(0, Math.min(r.x, maxW - 1));
  const y = Math.max(0, Math.min(r.y, maxH - 1));
  return { x, y, w: Math.max(1, Math.min(r.x + r.w, maxW) - x), h: Math.max(1, Math.min(r.y + r.h, maxH) - y) };
}
