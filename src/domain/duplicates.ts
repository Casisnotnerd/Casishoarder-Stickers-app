import type { Artist, Sheet } from './types';
import { normalizeText } from './text';

export function findSameTitle(title: string, artistId: string | null, sheets: Sheet[]): Sheet | null {
  const t = normalizeText(title);
  if (!t) return null;
  return (
    sheets.find(
      (s) => normalizeText(s.title) === t && (artistId === null || s.artistId === null || s.artistId === artistId),
    ) ?? null
  );
}

export function findArtistByName(name: string, artists: Artist[]): Artist | null {
  const n = normalizeText(name);
  if (!n) return null;
  return artists.find((a) => [a.name, ...a.aliases].some((x) => normalizeText(x) === n)) ?? null;
}
