import { clampFrame, DEFAULT_FRAME, encodeFrame, frameLayout, panFrame, parseFrame, zoomFrame } from '../../src/domain/tileFrame';

test('parseFrame reads new, old and bad values', () => {
  expect(parseFrame('frame:0.25,0.75,2')).toEqual({ x: 0.25, y: 0.75, zoom: 2 });
  expect(parseFrame('50% 20%')).toEqual({ x: 0.5, y: 0.2, zoom: 1 });
  expect(parseFrame(null)).toEqual(DEFAULT_FRAME);
  expect(parseFrame('banana')).toEqual(DEFAULT_FRAME);
  expect(parseFrame('frame:a,b,c')).toEqual(DEFAULT_FRAME);
});

test('encodeFrame rounds to 4 decimals and round-trips', () => {
  expect(encodeFrame({ x: 0.123456, y: 0.5, zoom: 1.6 })).toBe('frame:0.1235,0.5,1.6');
  expect(parseFrame(encodeFrame({ x: 0.3, y: 0.6, zoom: 2.5 }))).toEqual({ x: 0.3, y: 0.6, zoom: 2.5 });
});

test('zoom 1 always covers the frame', () => {
  for (const I of [4 / 3, 1, 3, 0.4]) {
    const l = frameLayout(DEFAULT_FRAME, I);
    expect(l.widthPct).toBeGreaterThanOrEqual(100);
    expect(l.heightPct).toBeGreaterThanOrEqual(100);
    expect(l.leftPct).toBeLessThanOrEqual(0);
    expect(l.topPct).toBeLessThanOrEqual(0);
    expect(l.leftPct + l.widthPct).toBeGreaterThanOrEqual(100 - 1e-9);
    expect(l.topPct + l.heightPct).toBeGreaterThanOrEqual(100 - 1e-9);
  }
  expect(frameLayout(DEFAULT_FRAME, 4 / 3)).toEqual({ widthPct: 100, heightPct: 100, leftPct: 0, topPct: 0 });
});

test('clamp pulls the centre back inside and keeps zoom in 1–4', () => {
  const c = clampFrame({ x: 0.9, y: 0.1, zoom: 1 }, 1);
  expect(c.x).toBeCloseTo(0.5);
  expect(c.y).toBeCloseTo(0.375);
  expect(c.zoom).toBe(1);
  expect(clampFrame({ x: 0.5, y: 0.5, zoom: 9 }, 1).zoom).toBe(4);
  expect(clampFrame({ x: 0.5, y: 0.5, zoom: 0.2 }, 1).zoom).toBe(1);
});

test('pan moves the photo with the finger', () => {
  expect(panFrame({ x: 0.5, y: 0.5, zoom: 2 }, 60, 0, 300, 4 / 3).x).toBeCloseTo(0.4);
  expect(panFrame({ x: 0.5, y: 0.5, zoom: 2 }, 0, -45, 300, 4 / 3).y).toBeCloseTo(0.6);
});

test('pan stops at the edge', () => {
  expect(panFrame({ x: 0.5, y: 0.5, zoom: 2 }, 5000, 5000, 300, 4 / 3)).toEqual({ x: 0.25, y: 0.25, zoom: 2 });
});

test('zoomFrame keeps the centre and re-clamps when zooming out', () => {
  expect(zoomFrame({ x: 0.3, y: 0.5, zoom: 2 }, 3, 4 / 3)).toEqual({ x: 0.3, y: 0.5, zoom: 3 });
  expect(zoomFrame({ x: 0.3, y: 0.5, zoom: 2 }, 1, 4 / 3)).toEqual({ x: 0.5, y: 0.5, zoom: 1 });
});
