import type { PhotoStore, Repo } from '../data/repo';
import { toMinor } from '../domain/currency';
import { findArtistByName } from '../domain/duplicates';
import { computeImageHash } from '../image/hash';
import { parseOrderForm, type OrderForm } from '../domain/orderForm';
import type { Artist } from '../domain/types';

export interface DraftLine {
  key: string;
  photo: Blob | null;
  thumb: Blob | null;
  title: string;
  artistName: string;
  tags: string;
  quantity: string;
  price: string;
  estimated: boolean;
  existingSheetId: string | null;
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveOrder(args: {
  repo: Repo;
  photos: PhotoStore;
  form: OrderForm;
  unknownOrder: boolean;
  drafts: DraftLine[];
}): Promise<SaveResult> {
  const { repo, photos, form, unknownOrder, drafts } = args;
  if (drafts.length === 0) return { ok: false, error: 'Add at least one sheet.' };
  const parsed = parseOrderForm(form);
  if (!parsed.ok) return parsed;
  const currency = unknownOrder ? 'SGD' : parsed.value.currency;

  const prepared = [];
  for (const d of drafts) {
    const label = d.title.trim() || 'Untitled sheet';
    if (!d.existingSheetId && !d.title.trim()) return { ok: false, error: 'Every new sheet needs a title.' };
    const qty = Number(d.quantity);
    if (!Number.isInteger(qty) || qty < 1) return { ok: false, error: `${label}: copies must be 1 or more.` };
    let priceMinor: number | null = null;
    if (d.price.trim()) {
      priceMinor = toMinor(d.price, currency);
      if (priceMinor === null) return { ok: false, error: `${label}: price is not a valid amount.` };
    }
    prepared.push({ d, qty, priceMinor });
  }

  const order = unknownOrder ? await repo.getOrCreateUnknownOrder() : await repo.createOrder(parsed.value);
  const artists: Artist[] = (await repo.loadAll()).artists;

  for (const { d, qty, priceMinor } of prepared) {
    let sheetId = d.existingSheetId;
    if (!sheetId) {
      let artistId: string | null = null;
      if (d.artistName.trim()) {
        let a = findArtistByName(d.artistName, artists);
        if (!a) {
          a = await repo.createArtist(d.artistName);
          artists.push(a);
        }
        artistId = a.id;
      }
      const photo = d.photo ? await photos.upload('photos', d.photo) : null;
      const thumb = d.thumb ? await photos.upload('thumbs', d.thumb) : null;
      const imageHash = d.thumb ? await computeImageHash(d.thumb) : null;
      const sheet = await repo.createSheet({
        artistId,
        title: d.title.trim(),
        tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean),
        photoPath: photo?.path ?? null,
        thumbPath: thumb?.path ?? null,
        photoBytes: (photo?.bytes ?? 0) + (thumb?.bytes ?? 0),
        imageHash,
      });
      sheetId = sheet.id;
    }
    await repo.addLine({ orderId: order.id, sheetId: sheetId!, quantity: qty, priceMinor, estimated: d.estimated });
  }
  return { ok: true };
}