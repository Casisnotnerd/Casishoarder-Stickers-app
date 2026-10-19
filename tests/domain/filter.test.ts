import type { Artist, Order, OrderLine, Sheet, Usage } from '../../src/domain/types';
import { EMPTY_FILTER, filterSheets, allTags } from '../../src/domain/filter';

const artists: Artist[] = [{ id: 'aP', name: 'papermilio', aliases: ['paper milio'] }];
const mk = (id: string, title: string, tags: string[], createdAt: string): Sheet => ({
  id, artistId: 'aP', title, tags, photoPath: null, thumbPath: null, photoBytes: 0, createdAt,
});
const sheets = [
  mk('w', 'Winter', ['seasonal'], '2026-01-01T00:00:00Z'),
  mk('e', '계란이 좋아', ['food'], '2026-02-01T00:00:00Z'),
  mk('s', 'Spring', ['seasonal'], '2026-03-01T00:00:00Z'),
];
const orders: Order[] = [{
  id: 'o', orderDate: '2026-10-05', shop: null, currency: 'SGD', shippingMinor: 0, totalMinor: null,
  sgdPaidMinor: null, estimated: false, isUnknown: false, createdAt: '2026-10-05T00:00:00Z',
}];
const lines: OrderLine[] = [
  { id: 'l1', orderId: 'o', sheetId: 'w', quantity: 1, priceMinor: 450, estimated: false },
  { id: 'l2', orderId: 'o', sheetId: 'e', quantity: 1, priceMinor: 300, estimated: false },
  { id: 'l3', orderId: 'o', sheetId: 's', quantity: 1, priceMinor: 600, estimated: false },
];
const usages: Usage[] = [{ id: 'u', sheetId: 's', quantity: 1, usedOn: '2026-10-10' }];
const d = { artists, sheets, orders, lines, usages };

test('default filter hides used-up sheets, newest first', () => {
  expect(filterSheets(EMPTY_FILTER, d).map((s) => s.id)).toEqual(['e', 'w']);
  expect(filterSheets({ ...EMPTY_FILTER, showUsedUp: true }, d).map((s) => s.id)).toEqual(['s', 'e', 'w']);
});

test('text search covers title, artist, alias, tags (Korean too)', () => {
  expect(filterSheets({ ...EMPTY_FILTER, text: 'win' }, d).map((s) => s.id)).toEqual(['w']);
  expect(filterSheets({ ...EMPTY_FILTER, text: '계란' }, d).map((s) => s.id)).toEqual(['e']);
  expect(filterSheets({ ...EMPTY_FILTER, text: 'paper milio' }, d)).toHaveLength(2);
  expect(filterSheets({ ...EMPTY_FILTER, text: 'food' }, d).map((s) => s.id)).toEqual(['e']);
});

test('tag, date and SGD price filters', () => {
  expect(filterSheets({ ...EMPTY_FILTER, tag: 'seasonal' }, d).map((s) => s.id)).toEqual(['w']);
  expect(filterSheets({ ...EMPTY_FILTER, dateFrom: '2026-11-01' }, d)).toHaveLength(0);
  expect(filterSheets({ ...EMPTY_FILTER, dateFrom: '2026-10-01', dateTo: '2026-10-31' }, d)).toHaveLength(2);
  expect(filterSheets({ ...EMPTY_FILTER, minSgdMinor: 400 }, d).map((s) => s.id)).toEqual(['w']);
  expect(filterSheets({ ...EMPTY_FILTER, maxSgdMinor: 400 }, d).map((s) => s.id)).toEqual(['e']);
});

test('allTags is sorted and unique', () => {
  expect(allTags(sheets)).toEqual(['food', 'seasonal']);
});