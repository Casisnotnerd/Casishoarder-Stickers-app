import { detectSheets, readingOrder } from '../../src/image/detect';
import type { Rect } from '../../src/image/geometry';

type RGB = [number, number, number];

/** Builds a w×h RGBA image: noisy background plus filled sheets with a few coloured "stickers" inside. */
function scene(w: number, h: number, bg: RGB, sheets: { r: Rect; fill: RGB }[], seed = 1): Uint8ClampedArray {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const px = new Uint8ClampedArray(w * h * 4);
  const set = (x: number, y: number, c: RGB) => {
    const i = (y * w + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = (rnd() - 0.5) * 16;
    set(x, y, [bg[0] + n, bg[1] + n, bg[2] + n]);
  }
  for (const { r, fill } of sheets) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set(x, y, fill);
    // a few darker stickers on the sheet, some touching its edge
    for (let k = 0; k < 4; k++) {
      const sx = r.x + Math.floor(rnd() * r.w * 0.7), sy = r.y + Math.floor(rnd() * r.h * 0.7);
      for (let y = sy; y < sy + r.h * 0.2; y++) for (let x = sx; x < sx + r.w * 0.2; x++) set(x, y, [200, 80, 90]);
    }
  }
  return px;
}

const near = (a: Rect, b: Rect, tol: number) =>
  Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol &&
  Math.abs(a.x + a.w - (b.x + b.w)) <= tol && Math.abs(a.y + a.h - (b.y + b.h)) <= tol;

test('finds four light sheets on a dark table, in reading order', () => {
  const truth: Rect[] = [
    { x: 20, y: 15, w: 120, h: 90 }, { x: 170, y: 20, w: 120, h: 85 },
    { x: 25, y: 125, w: 115, h: 90 }, { x: 175, y: 130, w: 115, h: 80 },
  ];
  const w = 320, h = 230;
  const found = detectSheets(scene(w, h, [40, 38, 36], truth.map((r) => ({ r, fill: [245, 240, 232] }))), w, h);
  expect(found).toHaveLength(4);
  found.forEach((f, i) => expect(near(f, truth[i], 8)).toBe(true));
});

test('also works for darker sheets on a light table', () => {
  const truth: Rect[] = [{ x: 30, y: 30, w: 110, h: 150 }, { x: 180, y: 40, w: 110, h: 140 }];
  const w = 320, h = 220;
  const found = detectSheets(scene(w, h, [235, 232, 225], truth.map((r) => ({ r, fill: [120, 160, 200] })), 7), w, h);
  expect(found).toHaveLength(2);
  found.forEach((f, i) => expect(near(f, truth[i], 8)).toBe(true));
});

test('an empty table gives no boxes', () => {
  const w = 200, h = 150;
  expect(detectSheets(scene(w, h, [50, 50, 50], []), w, h)).toEqual([]);
});

test('reading order goes row by row, left to right', () => {
  const a = { x: 200, y: 10, w: 80, h: 80 }, b = { x: 10, y: 14, w: 80, h: 80 }, c = { x: 100, y: 120, w: 80, h: 80 };
  expect(readingOrder([c, a, b])).toEqual([b, a, c]);
});
