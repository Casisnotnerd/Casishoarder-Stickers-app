import type { Order, OrderLine } from '../../src/domain/types';
import {
  itemsSumMinor, rateBaseMinor, effectiveSgdPaidMinor, lineSgdMinor,
  unitSgdMinor, shippingSgdMinor, derivedRate, orderMismatch,
} from '../../src/domain/money';

const order = (o: Partial<Order>): Order => ({
  id: 'o1', orderDate: '2026-10-19', shop: 'JUIMJUIM', currency: 'KRW',
  shippingMinor: 3000, totalMinor: 15000, sgdPaidMinor: 1560,
  estimated: false, isUnknown: false, createdAt: '2026-10-19T00:00:00Z', ...o,
});
const line = (l: Partial<OrderLine>): OrderLine => ({
  id: 'l1', orderId: 'o1', sheetId: 's1', quantity: 1, priceMinor: 3000, estimated: false, ...l,
});

// Spec example: ₩15,000 order (4 sheets × ₩3,000 + ₩3,000 shipping), S$15.60 paid.
const krwLines = [line({ id: 'a', sheetId: 'sA', quantity: 3 }), line({ id: 'b', sheetId: 'sB', quantity: 1 })];

test('spec example: ₩3,000 sheet costs S$3.12; rate 0.00104', () => {
  const o = order({});
  expect(unitSgdMinor(krwLines[0], o, krwLines)).toBe(312);
  expect(lineSgdMinor(krwLines[0], o, krwLines)).toBe(936);
  expect(lineSgdMinor(krwLines[1], o, krwLines)).toBe(312);
  expect(shippingSgdMinor(o, krwLines)).toBe(312);
  expect(derivedRate(o, krwLines)).toBeCloseTo(0.00104, 8);
});

test('blank order total falls back to items + shipping', () => {
  const o = order({ totalMinor: null });
  expect(itemsSumMinor(krwLines)).toBe(12000);
  expect(rateBaseMinor(o, krwLines)).toBe(15000);
  expect(unitSgdMinor(krwLines[0], o, krwLines)).toBe(312);
});

test('blank SGD paid gives null SGD amounts for foreign orders', () => {
  const o = order({ sgdPaidMinor: null });
  expect(effectiveSgdPaidMinor(o, krwLines)).toBeNull();
  expect(lineSgdMinor(krwLines[0], o, krwLines)).toBeNull();
  expect(derivedRate(o, krwLines)).toBeNull();
});

test('SGD orders need no SGD paid entry', () => {
  const lines = [line({ priceMinor: 450, quantity: 2 })];
  const o = order({ currency: 'SGD', shippingMinor: 0, totalMinor: null, sgdPaidMinor: null });
  expect(effectiveSgdPaidMinor(o, lines)).toBe(900);
  expect(unitSgdMinor(lines[0], o, lines)).toBe(450);
});

test('missing line price with blank total gives no base', () => {
  const lines = [line({ priceMinor: null })];
  const o = order({ totalMinor: null });
  expect(rateBaseMinor(o, lines)).toBeNull();
  expect(lineSgdMinor(lines[0], o, lines)).toBeNull();
});

test('orderMismatch reports discount differences', () => {
  expect(orderMismatch(order({}), krwLines)).toBeNull();
  const m = orderMismatch(order({ totalMinor: 14000 }), krwLines);
  expect(m).toEqual({ expectedMinor: 15000, totalMinor: 14000, diffMinor: -1000 });
  expect(orderMismatch(order({ totalMinor: null }), krwLines)).toBeNull();
});
