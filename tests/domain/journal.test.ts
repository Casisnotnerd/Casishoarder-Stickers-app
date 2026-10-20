import type { OrderLine, Sheet, Usage } from '../../src/domain/types';
import { addedLabel, addedThisMonth, sortSheets } from '../../src/domain/journal';

const now = new Date('2026-10-20T10:00:00+08:00');
const TZ = 'Asia/Singapore'; // the device time zone in the app
const sheet = (id: string, title: string, createdAt: string): Sheet => ({
  id, title, createdAt, artistId: null, tags: [], photoPath: null, thumbPath: null, photoBytes: 0, imageHash: null,
});

test('addedLabel says Today / Yesterday in local time, otherwise nothing', () => {
  expect(addedLabel('2026-10-20T01:00:00+08:00', now, TZ)).toBe('Today');
  expect(addedLabel('2026-10-19T23:30:00+08:00', now, TZ)).toBe('Yesterday');
  expect(addedLabel('2026-10-18T12:00:00+08:00', now, TZ)).toBeNull();
});

test('addedThisMonth counts sheets created in the current calendar month', () => {
  const s = [sheet('a', 'A', '2026-10-01T09:00:00+08:00'), sheet('b', 'B', '2026-10-19T09:00:00+08:00'), sheet('c', 'C', '2026-09-30T09:00:00+08:00')];
  expect(addedThisMonth(s, now, TZ)).toBe(2);
});

test('sortSheets: newest, oldest, A–Z, most copies', () => {
  const s = [sheet('w', 'Winter', '2026-01-01T00:00:00Z'), sheet('e', '계란이 좋아', '2026-03-01T00:00:00Z'), sheet('a', 'Autumn', '2026-02-01T00:00:00Z')];
  const lines: OrderLine[] = [
    { id: 'l1', orderId: 'o', sheetId: 'w', quantity: 3, priceMinor: null, estimated: false },
    { id: 'l2', orderId: 'o', sheetId: 'a', quantity: 2, priceMinor: null, estimated: false },
    { id: 'l3', orderId: 'o', sheetId: 'e', quantity: 4, priceMinor: null, estimated: false },
  ];
  const usages: Usage[] = [{ id: 'u', sheetId: 'e', quantity: 3, usedOn: '2026-10-01' }];
  const ids = (order: Parameters<typeof sortSheets>[1]) => sortSheets(s, order, lines, usages).map((x) => x.id);
  expect(ids('newest')).toEqual(['e', 'a', 'w']);
  expect(ids('oldest')).toEqual(['w', 'a', 'e']);
  expect(ids('az')).toEqual(['a', 'w', 'e']);
  expect(ids('copies')).toEqual(['w', 'a', 'e']);
});
