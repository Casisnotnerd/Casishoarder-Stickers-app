import { fitWithin, normalizeRect, fullRect } from '../../src/image/geometry';

test('fitWithin keeps aspect ratio and never upscales', () => {
  expect(fitWithin(4000, 3000, 1600)).toEqual({ w: 1600, h: 1200 });
  expect(fitWithin(3000, 4000, 1600)).toEqual({ w: 1200, h: 1600 });
  expect(fitWithin(800, 600, 1600)).toEqual({ w: 800, h: 600 });
});

test('normalizeRect works for any drag direction and clamps', () => {
  expect(normalizeRect({ x: 50, y: 80 }, { x: 10, y: 20 }, 100, 100)).toEqual({ x: 10, y: 20, w: 40, h: 60 });
  expect(normalizeRect({ x: -5, y: 10 }, { x: 120, y: 30 }, 100, 100)).toEqual({ x: 0, y: 10, w: 100, h: 20 });
});

test('fullRect leaves a 3% margin', () => {
  expect(fullRect(1000, 2000)).toEqual({ x: 30, y: 60, w: 940, h: 1880 });
});
