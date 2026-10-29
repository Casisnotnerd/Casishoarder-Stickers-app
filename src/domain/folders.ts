import type { Artist, OrderLine, Sheet, Usage } from './types';
import { copiesOwned } from './holdings';
import { normalizeText } from './text';

export const UNKNOWN_FOLDER = 'unknown';

export interface ArtistFolder {
  id: string; // first artist id of the group, or UNKNOWN_FOLDER
  name: string;
  artistIds: string[]; // artists with the same name (not merged yet) share one folder
  avatarPath: string | null;
  avatarPosition: string | null; // framing of avatarPath (see tileFrame.ts)
  owned: number; // sheets with at least 1 copy left
  usedUp: number; // sheets with every copy used
  cover: Sheet | null; // newest sheet still owned, else newest sheet
}

/** One folder per artist (A–Z), sheets without an artist last. Artists with no sheets are left out. */
export function artistFolders(artists: Artist[], sheets: Sheet[], lines: OrderLine[], usages: Usage[]): ArtistFolder[] {
  const byName = new Map<string, ArtistFolder>();
  const folderOf = new Map<string, ArtistFolder>();
  for (const a of artists) {
    const key = normalizeText(a.name) || a.id;
    let f = byName.get(key);
    if (!f) {
      f = { id: a.id, name: a.name, artistIds: [], avatarPath: null, avatarPosition: null, owned: 0, usedUp: 0, cover: null };
      byName.set(key, f);
    }
    f.artistIds.push(a.id);
    if (!f.avatarPath && a.avatarPath) {
      f.avatarPath = a.avatarPath;
      f.avatarPosition = a.avatarPosition;
    }
    folderOf.set(a.id, f);
  }
  const unknown: ArtistFolder = { id: UNKNOWN_FOLDER, name: 'Unknown artist', artistIds: [], avatarPath: null, avatarPosition: null, owned: 0, usedUp: 0, cover: null };
  const newestOwned = new Map<ArtistFolder, Sheet>();
  for (const s of sheets) {
    const f = (s.artistId && folderOf.get(s.artistId)) || unknown;
    const has = copiesOwned(s.id, lines, usages) > 0;
    if (has) f.owned++; else f.usedUp++;
    if (!f.cover || s.createdAt > f.cover.createdAt) f.cover = s;
    const no = newestOwned.get(f);
    if (has && (!no || s.createdAt > no.createdAt)) newestOwned.set(f, s);
  }
  const all = [...byName.values(), unknown].filter((f) => f.owned + f.usedUp > 0);
  for (const f of all) f.cover = newestOwned.get(f) ?? f.cover;
  const named = all.filter((f) => f !== unknown).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return all.includes(unknown) ? [...named, unknown] : named;
}

/** Sheets that belong in a folder. */
export function sheetsInFolder(folder: ArtistFolder, sheets: Sheet[], artists: Artist[]): Sheet[] {
  if (folder.id === UNKNOWN_FOLDER) {
    const known = new Set(artists.map((a) => a.id));
    return sheets.filter((s) => !s.artistId || !known.has(s.artistId));
  }
  const ids = new Set(folder.artistIds);
  return sheets.filter((s) => s.artistId !== null && ids.has(s.artistId));
}
