import type { Artist, OrderLine, Sheet, Usage } from '../../src/domain/types';
import { artistFolders, sheetsInFolder, UNKNOWN_FOLDER } from '../../src/domain/folders';

const artist = (id: string, name: string, avatarPath: string | null = null): Artist => ({ id, name, aliases: [], avatarPath, avatarBytes: 0 });
const sheet = (id: string, artistId: string | null, createdAt: string): Sheet => ({
  id, artistId, title: id, tags: [], photoPath: null, thumbPath: null, photoBytes: 0, imageHash: null, createdAt,
});
const line = (sheetId: string, quantity = 1): OrderLine => ({ id: `l-${sheetId}`, orderId: 'o', sheetId, quantity, priceMinor: null, estimated: false });

test('folders A–Z with owned / used-up counts, unknown last, empty artists hidden', () => {
  const artists = [artist('m', 'mumu'), artist('p', 'Papermilio', 'thumbs/p.jpg'), artist('z', 'zzz'), artist('b', 'bunny')];
  const sheets = [
    sheet('p1', 'p', '2026-01-01'), sheet('p2', 'p', '2026-03-01'), sheet('p3', 'p', '2026-05-01'),
    sheet('m1', 'm', '2026-02-01'), sheet('u1', null, '2026-04-01'), sheet('b1', 'b', '2026-02-02'),
  ];
  const lines = sheets.map((s) => line(s.id));
  const usages: Usage[] = [{ id: 'u', sheetId: 'p3', quantity: 1, usedOn: '2026-06-01' }];
  const f = artistFolders(artists, sheets, lines, usages);
  expect(f.map((x) => x.name)).toEqual(['bunny', 'mumu', 'Papermilio', 'Unknown artist']);
  const p = f[2];
  expect(p).toMatchObject({ owned: 2, usedUp: 1, avatarPath: 'thumbs/p.jpg' });
  expect(p.cover?.id).toBe('p2'); // newest sheet still owned, not the used-up p3
  expect(f[3].id).toBe(UNKNOWN_FOLDER);
  expect(sheetsInFolder(f[3], sheets, artists).map((s) => s.id)).toEqual(['u1']);
});

test('two artists with the same name share one folder', () => {
  const artists = [artist('a1', 'JUIMJUIM'), artist('a2', 'juimjuim')];
  const sheets = [sheet('s1', 'a1', '2026-01-01'), sheet('s2', 'a2', '2026-01-02')];
  const f = artistFolders(artists, sheets, sheets.map((s) => line(s.id)), []);
  expect(f).toHaveLength(1);
  expect(f[0].owned).toBe(2);
  expect(sheetsInFolder(f[0], sheets, artists).map((s) => s.id)).toEqual(['s1', 's2']);
});
