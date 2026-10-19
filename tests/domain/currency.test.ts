import { exponent, toMinor, minorToInput, formatMoney } from '../../src/domain/currency';
import { normalizeText } from '../../src/domain/text';

test('exponent: KRW has no decimals, SGD has 2, unknown defaults to 2', () => {
  expect(exponent('KRW')).toBe(0);
  expect(exponent('sgd')).toBe(2);
  expect(exponent('XYZ')).toBe(2);
});

test('toMinor parses decimal strings into minor units', () => {
  expect(toMinor('3000', 'KRW')).toBe(3000);
  expect(toMinor('3,000', 'KRW')).toBe(3000);
  expect(toMinor('15.60', 'SGD')).toBe(1560);
  expect(toMinor('15.6', 'SGD')).toBe(1560);
  expect(toMinor(' 4 ', 'SGD')).toBe(400);
});

test('toMinor rejects invalid or over-precise input', () => {
  expect(toMinor('', 'SGD')).toBeNull();
  expect(toMinor('abc', 'SGD')).toBeNull();
  expect(toMinor('1.234', 'SGD')).toBeNull();
  expect(toMinor('3000.5', 'KRW')).toBeNull();
  expect(toMinor('-1', 'SGD')).toBeNull();
});

test('minorToInput formats for editing', () => {
  expect(minorToInput(1560, 'SGD')).toBe('15.60');
  expect(minorToInput(3000, 'KRW')).toBe('3000');
});

test('formatMoney shows a dash for unknown SGD', () => {
  expect(formatMoney(null, 'SGD')).toBe('S$ —');
  expect(formatMoney(null, 'KRW')).toBe('KRW —');
  expect(formatMoney(312, 'SGD')).toMatch(/3\.12/);
  expect(formatMoney(3000, 'KRW')).toMatch(/3,000/);
});

test('normalizeText trims, lowercases and collapses spaces', () => {
  expect(normalizeText('  Winter   Sheet ')).toBe('winter sheet');
  expect(normalizeText('계란이  좋아')).toBe('계란이 좋아');
});