import type { OrderLine, Usage } from '../../src/domain/types';
import { copiesBought, copiesUsed, copiesOwned, usageError } from '../../src/domain/holdings';

const lines: OrderLine[] = [
  { id: 'l1', orderId: 'o1', sheetId: 'winter', quantity: 2, priceMinor: 450, estimated: false },
  { id: 'l2', orderId: 'o2', sheetId: 'winter', quantity: 1, priceMinor: 450, estimated: false },
  { id: 'l3', orderId: 'o2', sheetId: 'spring', quantity: 1, priceMinor: 450, estimated: false },
];
const usages: Usage[] = [{ id: 'u1', sheetId: 'winter', quantity: 1, usedOn: '2026-10-19' }];

test('copies owned = bought − used', () => {
  expect(copiesBought('winter', lines)).toBe(3);
  expect(copiesUsed('winter', usages)).toBe(1);
  expect(copiesOwned('winter', lines, usages)).toBe(2);
  expect(copiesOwned('spring', lines, usages)).toBe(1);
  expect(copiesOwned('none', lines, usages)).toBe(0);
});

test('usageError blocks using more than owned or invalid numbers', () => {
  expect(usageError('winter', 2, lines, usages)).toBeNull();
  expect(usageError('winter', 3, lines, usages)).toBe('You only have 2 copies.');
  expect(usageError('spring', 2, lines, usages)).toBe('You only have 1 copy.');
  expect(usageError('winter', 0, lines, usages)).toBe('Enter a whole number of 1 or more.');
  expect(usageError('winter', 1.5, lines, usages)).toBe('Enter a whole number of 1 or more.');
});
