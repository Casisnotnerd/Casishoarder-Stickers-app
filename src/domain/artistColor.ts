export interface ArtistColor {
  tab: string; // fill for the artist's tab / edge / chart bar
  ink: string; // readable text colour on that fill
}

export const ARTIST_PALETTE: ArtistColor[] = [
  { tab: '#FFD84D', ink: '#4A3A00' }, // marigold
  { tab: '#8FD3C1', ink: '#0D4A3C' }, // mint
  { tab: '#F7A6C4', ink: '#6B1638' }, // peony
  { tab: '#A9C7FF', ink: '#14336E' }, // sky
  { tab: '#FFB27A', ink: '#6A2F05' }, // apricot
  { tab: '#C6B3FF', ink: '#35206E' }, // lilac
  { tab: '#B9E07A', ink: '#2F4A07' }, // lime
  { tab: '#F28B82', ink: '#6A1410' }, // coral
];

const NONE: ArtistColor = { tab: '#D9D3EA', ink: '#3B2F5C' };

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
