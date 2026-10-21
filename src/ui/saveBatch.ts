import type { PhotoStore, Repo } from '../data/repo';
import { toMinor } from '../domain/currency';
import { findArtistByName } from '../domain/duplicates';
import type { Artist } from '../domain/types';

/** Order details asked once when a bulk order starts (all optional). */
export interface BatchOrderInfo {
  date: string;
  shop: string;
  shipping: string; // S$
}

/** One sheet cut out of a group photo. */
export interface BatchRow {
  key: string;
  photo: Blob | null;
  thumb: Blob | null;
  imageHash: string | null;
  title: string;
  artistName: string; // starts as the photo's artist, can be switched per row
  price: string; // each, order currency; starts as the photo's price
  existingSheetId: string | null; // "add a copy to the sheet I already have"
}

export type BatchResult = { ok: true; orderId: string; saved: number } | { ok: false; error: string };

export function parseBatchOrder(info: BatchOrderInfo):
  { ok: true; value: { orderDate: string | null; shop: string | null; shippingMinor: number } } | { ok: false; error: string } {
  let shippingMinor = 0;
  if (info.shipping.trim()) {
    const v = toMinor(info.shipping, 'SGD');
    if (v === null) return { ok: false, error: 'Shipping: not a valid amount.' };
    shippingMinor = v;
  }
  return { ok: true, value: { orderDate: info.date.trim() || null, shop: info.shop.trim() || null, shippingMinor } };
}

/**
 * Saves the sheets from one group photo. Creates the order on the first photo
 * (orderId null) and adds to it on later photos. Each sheet gets 1 copy.
 */
export async function saveBatch(args: {
  repo: Repo;
  photos: PhotoStore;
  orderId: string | null;
  currency: string; // 'SGD' for new bulk orders; an existing order keeps its own currency
  info: BatchOrderInfo;
  tags: string; // comma-separated, applied to every new sheet in this photo
  rows: BatchRow[];
}): Promise<BatchResult> {
  const { repo, photos, currency, info, tags, rows } = args;
  if (rows.length === 0) return { ok: false, error: 'There are no sheets to save. Add a box around a sheet first.' };

  const prepared: { row: BatchRow; priceMinor: number | null }[] = [];
  for (const [i, row] of rows.entries()) {
    const label = row.title.trim() || `Sheet ${i + 1}`;
    if (!row.existingSheetId && !row.title.trim()) return { ok: false, error: `Sheet ${i + 1} needs a title.` };
    let priceMinor: number | null = null;
    if (row.price.trim()) {
      priceMinor = toMinor(row.price, currency);
      if (priceMinor === null) return { ok: false, error: `${label}: price is not a valid amount.` };
    }
    prepared.push({ row, priceMinor });
  }

  let orderId = args.orderId;
  if (!orderId) {
    const parsed = parseBatchOrder(info);
    if (!parsed.ok) return parsed;
    const order = await repo.createOrder({
      ...parsed.value, currency: 'SGD', totalMinor: null, sgdPaidMinor: null, estimated: false,
    });
    orderId = order.id;
  }

  const tagList = [...new Set(tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))];
  const artists: Artist[] = (await repo.loadAll()).artists;

  for (const { row, priceMinor } of prepared) {
    let sheetId = row.existingSheetId;
    if (!sheetId) {
      let artistId: string | null = null;
      if (row.artistName.trim()) {
        let a = findArtistByName(row.artistName, artists);
        if (!a) {
          a = await repo.createArtist(row.artistName.trim());
          artists.push(a);
        }
        artistId = a.id;
      }
      const photo = row.photo ? await photos.upload('photos', row.photo) : null;
      const thumb = row.thumb ? await photos.upload('thumbs', row.thumb) : null;
      const sheet = await repo.createSheet({
        artistId,
        title: row.title.trim(),
        tags: tagList,
        photoPath: photo?.path ?? null,
        thumbPath: thumb?.path ?? null,
        photoBytes: (photo?.bytes ?? 0) + (thumb?.bytes ?? 0),
        imageHash: row.imageHash,
      });
      sheetId = sheet.id;
    }
    await repo.addLine({ orderId, sheetId, quantity: 1, priceMinor, estimated: false });
  }
  return { ok: true, orderId, saved: prepared.length };
}
