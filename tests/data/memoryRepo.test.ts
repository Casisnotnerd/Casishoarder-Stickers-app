import { MemoryRepo } from '../../src/data/memoryRepo';
import type { NewOrder } from '../../src/data/repo';

const krwOrder: NewOrder = {
  orderDate: '2026-10-19', shop: 'JUIMJUIM', currency: 'KRW', shippingMinor: 3000,
  totalMinor: 15000, sgdPaidMinor: 1560, estimated: false,
};
const sheetInput = (title: string, artistId: string | null = null) => ({
  artistId, title, tags: [], photoPath: null, thumbPath: null, photoBytes: 0, imageHash: null,
});

test('deleteSheet removes lines and usages, and orders left empty', async () => {
  const r = new MemoryRepo();
  const a = await r.createSheet(sheetInput('A'));
  const b = await r.createSheet(sheetInput('B'));
  const shared = await r.createOrder(krwOrder);
  const solo = await r.createOrder(krwOrder);
  await r.addLine({ orderId: shared.id, sheetId: a.id, quantity: 1, priceMinor: 3000, estimated: false });
  await r.addLine({ orderId: shared.id, sheetId: b.id, quantity: 1, priceMinor: 3000, estimated: false });
  await r.addLine({ orderId: solo.id, sheetId: a.id, quantity: 2, priceMinor: 3000, estimated: false });
  await r.addUsage(a.id, 1, '2026-10-20');

  await r.deleteSheet(a.id);
  const s = await r.loadAll();
  expect(s.sheets.map((x) => x.id)).toEqual([b.id]);
  expect(s.lines.every((l) => l.sheetId === b.id)).toBe(true);
  expect(s.usages).toHaveLength(0);
  expect(s.orders.map((o) => o.id)).toEqual([shared.id]);
});

test('getOrCreateUnknownOrder is created once', async () => {
  const r = new MemoryRepo();
  const u1 = await r.getOrCreateUnknownOrder();
  const u2 = await r.getOrCreateUnknownOrder();
  expect(u1.id).toBe(u2.id);
  expect(u1.isUnknown).toBe(true);
  expect(u1.sgdPaidMinor).toBeNull();
});

test('mergeArtists moves sheets and keeps the old name as alias', async () => {
  const r = new MemoryRepo();
  const keep = await r.createArtist('JUIMJUIM');
  const typo = await r.createArtist('Juimsuim');
  await r.createSheet(sheetInput('Egg', typo.id));
  await r.mergeArtists(keep.id, typo.id);
  const s = await r.loadAll();
  expect(s.artists).toEqual([{ id: keep.id, name: 'JUIMJUIM', aliases: ['Juimsuim'] }]);
  expect(s.sheets[0].artistId).toBe(keep.id);
});

test('addUsage rejects using more copies than owned', async () => {
  const r = new MemoryRepo();
  const a = await r.createSheet(sheetInput('A'));
  const o = await r.getOrCreateUnknownOrder();
  await r.addLine({ orderId: o.id, sheetId: a.id, quantity: 1, priceMinor: null, estimated: false });
  await expect(r.addUsage(a.id, 2, '2026-10-20')).rejects.toThrow();
});

test('sharedCollection: only when enabled, hides used-up, no price fields', async () => {
  const r = new MemoryRepo();
  const artist = await r.createArtist('papermilio');
  const w = await r.createSheet(sheetInput('Winter', artist.id));
  const s = await r.createSheet(sheetInput('Spring', artist.id));
  const o = await r.createOrder({ ...krwOrder, currency: 'SGD', totalMinor: null, sgdPaidMinor: null, shippingMinor: 0 });
  await r.addLine({ orderId: o.id, sheetId: w.id, quantity: 1, priceMinor: 450, estimated: false });
  await r.addLine({ orderId: o.id, sheetId: s.id, quantity: 1, priceMinor: 450, estimated: false });
  await r.addUsage(s.id, 1, '2026-10-20');

  const off = await r.setShareLinkEnabled(false);
  expect(await r.sharedCollection(off.token)).toEqual([]);
  const on = await r.setShareLinkEnabled(true);
  expect(on.token).toBe(off.token);
  const shared = await r.sharedCollection(on.token);
  expect(shared).toEqual([{ sheetId: w.id, title: 'Winter', artist: 'papermilio', thumbPath: null }]);
  expect(Object.keys(shared[0]).sort()).toEqual(['artist', 'sheetId', 'thumbPath', 'title']);
  expect(await r.sharedCollection('wrong')).toEqual([]);
});