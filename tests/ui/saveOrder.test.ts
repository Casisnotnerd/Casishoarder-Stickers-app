import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { saveOrder, type DraftLine } from '../../src/ui/saveOrder';
import { EMPTY_ORDER_FORM } from '../../src/domain/orderForm';

const draft = (d: Partial<DraftLine>): DraftLine => ({
  key: 'k', photo: null, thumb: null, title: 'Egg', artistName: 'JUIMJUIM', tags: 'food, korean',
  quantity: '1', price: '3000', estimated: false, existingSheetId: null, ...d,
});

test('saves a KRW order with new artist, sheets, lines', async () => {
  const repo = new MemoryRepo();
  const res = await saveOrder({
    repo, photos: new MemoryPhotoStore(), unknownOrder: false,
    form: { ...EMPTY_ORDER_FORM, date: '2026-10-19', currency: 'KRW', shipping: '3000', total: '15000', sgdPaid: '15.60' },
    drafts: [draft({ key: 'a', quantity: '3' }), draft({ key: 'b', title: 'Dumpling', artistName: 'juimjuim' })],
  });
  expect(res).toEqual({ ok: true });
  const s = await repo.loadAll();
  expect(s.artists).toHaveLength(1);
  expect(s.sheets.map((x) => x.title).sort()).toEqual(['Dumpling', 'Egg']);
  expect(s.sheets[0].tags).toEqual(['food', 'korean']);
  expect(s.orders[0]).toMatchObject({ currency: 'KRW', totalMinor: 15000, sgdPaidMinor: 1560 });
  expect(s.lines.map((l) => l.quantity).sort()).toEqual([1, 3]);
});

test('existing sheet gets copies added instead of a new sheet', async () => {
  const repo = new MemoryRepo();
  const w = await repo.createSheet({ artistId: null, title: 'Winter', tags: [], photoPath: null, thumbPath: null, photoBytes: 0 , imageHash: null});
  const res = await saveOrder({
    repo, photos: new MemoryPhotoStore(), unknownOrder: true, form: EMPTY_ORDER_FORM,
    drafts: [draft({ existingSheetId: w.id, quantity: '2', price: '' })],
  });
  expect(res).toEqual({ ok: true });
  const s = await repo.loadAll();
  expect(s.sheets).toHaveLength(1);
  expect(s.orders[0].isUnknown).toBe(true);
  expect(s.lines[0]).toMatchObject({ sheetId: w.id, quantity: 2, priceMinor: null });
});

test('validation errors stop the save and name the sheet', async () => {
  const repo = new MemoryRepo();
  const bad = await saveOrder({
    repo, photos: new MemoryPhotoStore(), unknownOrder: false,
    form: { ...EMPTY_ORDER_FORM, currency: 'KRW' }, drafts: [draft({ price: '3000.5' })],
  });
  expect(bad).toEqual({ ok: false, error: 'Egg: price is not a valid amount.' });
  const none = await saveOrder({ repo, photos: new MemoryPhotoStore(), unknownOrder: false, form: EMPTY_ORDER_FORM, drafts: [] });
  expect(none).toEqual({ ok: false, error: 'Add at least one sheet.' });
  const qty = await saveOrder({ repo, photos: new MemoryPhotoStore(), unknownOrder: false, form: EMPTY_ORDER_FORM, drafts: [draft({ quantity: '0' })] });
  expect(qty).toEqual({ ok: false, error: 'Egg: copies must be 1 or more.' });
  expect((await repo.loadAll()).orders).toHaveLength(0);
});
