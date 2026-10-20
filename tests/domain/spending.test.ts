import type { Artist, Order, OrderLine, Sheet } from '../../src/domain/types';
import { summarizeSpending } from '../../src/domain/spending';

const artists: Artist[] = [
  { id: 'aJ', name: 'JUIMJUIM', aliases: [], avatarPath: null, avatarBytes: 0 },
  { id: 'aP', name: 'papermilio', aliases: [], avatarPath: null, avatarBytes: 0 },
];
const sheet = (id: string, artistId: string | null): Sheet => ({
  id, artistId, title: id, tags: [], photoPath: null, thumbPath: null, photoBytes: 0, imageHash: null, createdAt: '2026-01-01T00:00:00Z',
});
const sheets = [sheet('egg', 'aJ'), sheet('dumpling', 'aJ'), sheet('winter', 'aP'), sheet('mystery', null)];
const base: Omit<Order, 'id'> = {
  orderDate: null, shop: null, currency: 'SGD', shippingMinor: 0, totalMinor: null, sgdPaidMinor: null,
  estimated: false, isUnknown: false, createdAt: '2026-01-01T00:00:00Z',
};
const orders: Order[] = [
  { ...base, id: 'krw', orderDate: '2026-10-05', currency: 'KRW', shippingMinor: 3000, totalMinor: 15000, sgdPaidMinor: 1560 },
  { ...base, id: 'sgdEst', estimated: true },
  { ...base, id: 'krwMissing', orderDate: '2026-09-01', currency: 'KRW', totalMinor: 6000 },
  { ...base, id: 'unknown', isUnknown: true },
];
const lines: OrderLine[] = [
  { id: 'l1', orderId: 'krw', sheetId: 'egg', quantity: 3, priceMinor: 3000, estimated: false },
  { id: 'l2', orderId: 'krw', sheetId: 'dumpling', quantity: 1, priceMinor: 3000, estimated: false },
  { id: 'l3', orderId: 'sgdEst', sheetId: 'winter', quantity: 2, priceMinor: 450, estimated: false },
  { id: 'l4', orderId: 'krwMissing', sheetId: 'mystery', quantity: 2, priceMinor: 3000, estimated: false },
  { id: 'l5', orderId: 'unknown', sheetId: 'mystery', quantity: 1, priceMinor: null, estimated: false },
];

test('summarizeSpending totals, buckets and missing SGD', () => {
  const s = summarizeSpending({ artists, sheets, orders, lines });
  expect(s.totalMinor).toBe(2460);
  expect(s.exactMinor).toBe(1560);
  expect(s.estimatedMinor).toBe(900);
  expect(s.shippingMinor).toBe(312);
  expect(s.otherMinor).toBe(0);
  expect(s.byArtist).toEqual([
    { label: 'JUIMJUIM', minor: 1248 },
    { label: 'papermilio', minor: 900 },
  ]);
  expect(s.byMonth).toEqual([
    { label: '2026-10', minor: 1560 },
    { label: 'No date', minor: 900 },
  ]);
  expect(s.missingSgdOrderIds).toEqual(['krwMissing']);
});

test('discount shows up as negative "other"', () => {
  const discounted = orders.map((o) => (o.id === 'krw' ? { ...o, totalMinor: 14000 } : o));
  const s = summarizeSpending({ artists, sheets, orders: discounted, lines });
  // base 14000: egg 3×3000→1003, dumpling →334, shipping →334; parts 1671; paid 1560; other −111
  expect(s.otherMinor).toBe(-111);
  expect(s.totalMinor).toBe(2460);
});
