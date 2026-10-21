import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { saveBatch, type BatchRow } from '../../src/ui/saveBatch';
import { effectiveSgdPaidMinor, linesOf } from '../../src/domain/money';

const row = (r: Partial<BatchRow>): BatchRow => ({
  key: 'k', photo: null, thumb: null, imageHash: null, title: 'Winter', artistName: 'papermilio', price: '3.50',
  existingSheetId: null, ...r,
});
const info = { date: '2026-10-01', shop: 'Etsy', shipping: '4' };

test('two photos go into one order; total = sheets × price + shipping', async () => {
  const repo = new MemoryRepo();
  const photos = new MemoryPhotoStore();
  const first = await saveBatch({
    repo, photos, orderId: null, currency: 'SGD', info, tags: 'Seasons, cute, seasons',
    rows: [row({ key: 'a' }), row({ key: 'b', title: 'Autumn' }), row({ key: 'c', title: 'Daisies', artistName: 'Mumu', price: '5' })],
  });
  expect(first.ok).toBe(true);
  if (!first.ok) return;
  const second = await saveBatch({
    repo, photos, orderId: first.orderId, currency: 'SGD', info, tags: '',
    rows: [row({ key: 'd', title: 'Spring', artistName: 'PAPERMILIO' })],
  });
  expect(second).toEqual({ ok: true, orderId: first.orderId, saved: 1 });

  const s = await repo.loadAll();
  expect(s.orders).toHaveLength(1);
  expect(s.orders[0]).toMatchObject({ orderDate: '2026-10-01', shop: 'Etsy', currency: 'SGD', shippingMinor: 400 });
  expect(s.artists.map((a) => a.name).sort()).toEqual(['Mumu', 'papermilio']);
  expect(s.lines.every((l) => l.quantity === 1)).toBe(true);
  expect(s.sheets.find((x) => x.title === 'Winter')!.tags).toEqual(['seasons', 'cute']);
  // 3 × 3.50 + 5 + 4 shipping = 19.50
  expect(effectiveSgdPaidMinor(s.orders[0], linesOf(s.orders[0], s.lines))).toBe(1950);
});

test('a row can add a copy to a sheet you already have', async () => {
  const repo = new MemoryRepo();
  const w = await repo.createSheet({ artistId: null, title: 'Winter', tags: [], photoPath: null, thumbPath: null, photoBytes: 0, imageHash: null });
  const r = await saveBatch({ repo, photos: new MemoryPhotoStore(), orderId: null, currency: 'SGD', info, tags: '', rows: [row({ existingSheetId: w.id })] });
  expect(r.ok).toBe(true);
  const s = await repo.loadAll();
  expect(s.sheets).toHaveLength(1);
  expect(s.lines[0]).toMatchObject({ sheetId: w.id, quantity: 1, priceMinor: 350 });
});

test('problems stop the save before anything is written', async () => {
  const repo = new MemoryRepo();
  const photos = new MemoryPhotoStore();
  const base = { repo, photos, orderId: null, currency: 'SGD', info, tags: '' };
  expect(await saveBatch({ ...base, rows: [] })).toMatchObject({ ok: false });
  expect(await saveBatch({ ...base, rows: [row({}), row({ title: ' ' })] })).toEqual({ ok: false, error: 'Sheet 2 needs a title.' });
  expect(await saveBatch({ ...base, rows: [row({ price: 'abc' })] })).toEqual({ ok: false, error: 'Winter: price is not a valid amount.' });
  expect(await saveBatch({ ...base, info: { ...info, shipping: 'x' }, rows: [row({})] })).toEqual({ ok: false, error: 'Shipping: not a valid amount.' });
  const s = await repo.loadAll();
  expect(s.orders).toHaveLength(0);
  expect(s.sheets).toHaveLength(0);
});

test('price can be left blank', async () => {
  const repo = new MemoryRepo();
  const r = await saveBatch({ repo, photos: new MemoryPhotoStore(), orderId: null, currency: 'SGD', info: { date: '', shop: '', shipping: '' }, tags: '', rows: [row({ price: '' })] });
  expect(r.ok).toBe(true);
  const s = await repo.loadAll();
  expect(s.orders[0]).toMatchObject({ orderDate: null, shop: null, shippingMinor: 0 });
  expect(s.lines[0].priceMinor).toBeNull();
});
