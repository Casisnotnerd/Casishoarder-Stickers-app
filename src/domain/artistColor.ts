export interface ArtistColor {
  tab: string; // soft tint for the artist's tab, card mount and chart bar
  ink: string; // readable text colour on that tint
}

// Warm pastel tints, starting from the Figma card colours (sage, lilac, peach, butter).
export const ARTIST_PALETTE: ArtistColor[] = [
  { tab: '#E3E9DC', ink: '#3D5233' }, // sage
  { tab: '#E9E3F1', ink: '#4A3870' }, // lilac
  { tab: '#F2DFD0', ink: '#7A3E1E' }, // peach
  { tab: '#F3E8C4', ink: '#6B5410' }, // butter
  { tab: '#F3D9DC', ink: '#7A2E3A' }, // rose
  { tab: '#DCE7F0', ink: '#2C4A63' }, // sky
  { tab: '#D7EBE3', ink: '#245244' }, // mint
  { tab: '#EADFCF', ink: '#5E4A2E' }, // sand
];

const NONE: ArtistColor = { tab: '#ECE7DD', ink: '#30342C' };

/** Stable colour per artist id (FNV-1a hash → palette slot). */
export function artistColor(artistId: string | null): ArtistColor {
  if (!artistId) return NONE;
  let h = 0x811c9dc5;
  for (let i = 0; i < artistId.length; i++) {
    h ^= artistId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ARTIST_PALETTE[h % ARTIST_PALETTE.length];
}
