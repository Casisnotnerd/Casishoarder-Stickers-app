import type { Artist, Order, OrderLine, Sheet, Usage } from '../../src/domain/types';
import { csvEscape, toCsv, collectionCsv } from '../../src/domain/csv';

test('csvEscape quotes commas, quotes and newlines', () => {
  expect(csvEscape('plain')).toBe('plain');
  expect(csvEscape('a,b')).toBe('"a,b"');
  expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  expect(csvEscape(null)).toBe('');
  expect(csvEscape(3)).toBe('3');
});

test('toCsv starts with a UTF-8 BOM so Excel shows Korean', () => {
  expect(toCsv([['계란이 좋아']])).toBe('\uFEFF계란이 좋아\r\n');
});

test('collectionCsv: one row per order line, SGD per sheet', () => {
  const artists: Artist[] = [{ id: 'aJ', name: 'JUIMJUIM', aliases: [] }];
  const sheets: Sheet[] = [
    { id: 'egg', artistId: 'aJ', title: '계란이 좋아', tags: ['food', 'korean'], photoPath: null, thumbPath: null, photoBytes: 0, createdAt: '' },
    { id: 'none', artistId: null, title: 'No order yet', tags: [], photoPath: null, thumbPath: null, photoBytes: 0, createdAt: '' },
  ];
  const orders: Order[] = [{
    id: 'o', orderDate: '2026-10-19', shop: 'Shop, Seoul', currency: 'KRW', shippingMinor: 3000,
    totalMinor: 15000, sgdPaidMinor: 1560, estimated: false, isUnknown: false, createdAt: '',
  }];
  const lines: OrderLine[] = [{ id: 'l', orderId: 'o', sheetId: 'egg', quantity: 4, priceMinor: 3000, estimated: false }];
  const usages: Usage[] = [{ id: 'u', sheetId: 'egg', quantity: 1, usedOn: '2026-10-20' }];
  const rows = collectionCsv({ artists, sheets, orders, lines, usages }).replace('\uFEFF', '').trim().split('\r\n');
  expect(rows[0]).toBe('Title,Artist,Tags,Copies owned,Order date,Shop,Currency,Quantity,Price each,Price each (SGD),Estimated');
  expect(rows[1]).toBe('No order yet,,,0,,,,,,,');
  expect(rows[2]).toBe('계란이 좋아,JUIMJUIM,food; korean,3,2026-10-19,"Shop, Seoul",KRW,4,3000,3.12,no');
});