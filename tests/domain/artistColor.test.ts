import { ARTIST_PALETTE, artistColor } from '../../src/domain/artistColor';

test('same artist always gets the same colour', () => {
  expect(artistColor('artist-7')).toEqual(artistColor('artist-7'));
});

test('colours come from the palette and include readable ink', () => {
  const c = artistColor('2b6f0d4e-uuid');
  expect(ARTIST_PALETTE).toContainEqual(c);
  expect(c.tab).toMatch(/^#[0-9A-F]{6}$/i);
  expect(c.ink).toMatch(/^#[0-9A-F]{6}$/i);
});

test('no artist gets the neutral colour', () => {
  expect(artistColor(null)).toEqual({ tab: '#ECE7DD', ink: '#30342C' });
});

test('different artists spread across the palette', () => {
  const used = new Set(Array.from({ length: 40 }, (_, i) => artistColor(`artist-${i}`).tab));
  expect(used.size).toBeGreaterThanOrEqual(6);
});
