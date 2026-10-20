import type { SupabaseClient } from '@supabase/supabase-js';
import type { Artist, Order, OrderLine, Sheet, ShareLink, Usage } from '../domain/types';
import { usageError } from '../domain/holdings';
import type { NewLine, NewOrder, NewSheet, PhotoKind, PhotoStore, Repo, SharedSheet, SheetPatch, Snapshot } from './repo';
import { randomToken } from './token';

type Row = Record<string, unknown>;
interface Res<T> { data: T | null; error: { message: string } | null }

function ok<T>(r: Res<T>): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

const artistFrom = (r: Row): Artist => ({ id: r.id as string, name: r.name as string, aliases: (r.aliases as string[]) ?? [] });
const sheetFrom = (r: Row): Sheet => ({
  id: r.id as string, artistId: (r.artist_id as string | null) ?? null, title: r.title as string,
  tags: (r.tags as string[]) ?? [], photoPath: (r.photo_path as string | null) ?? null,
  thumbPath: (r.thumb_path as string | null) ?? null, photoBytes: Number(r.photo_bytes ?? 0),
  imageHash: (r.image_hash as string | null) ?? null, createdAt: r.created_at as string,
});
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const orderFrom = (r: Row): Order => ({
  id: r.id as string, orderDate: (r.order_date as string | null) ?? null, shop: (r.shop as string | null) ?? null,
  currency: r.currency as string, shippingMinor: Number(r.shipping_minor ?? 0), totalMinor: num(r.total_minor),
  sgdPaidMinor: num(r.sgd_paid_minor), estimated: Boolean(r.estimated), isUnknown: Boolean(r.is_unknown),
  createdAt: r.created_at as string,
});
const lineFrom = (r: Row): OrderLine => ({
  id: r.id as string, orderId: r.order_id as string, sheetId: r.sheet_id as string,
  quantity: Number(r.quantity), priceMinor: num(r.price_minor), estimated: Boolean(r.estimated),
});
const usageFrom = (r: Row): Usage => ({
  id: r.id as string, sheetId: r.sheet_id as string, quantity: Number(r.quantity), usedOn: r.used_on as string,
});

const orderTo = (o: Partial<NewOrder>): Row => {
  const m: Row = {};
  if (o.orderDate !== undefined) m.order_date = o.orderDate;
  if (o.shop !== undefined) m.shop = o.shop;
  if (o.currency !== undefined) m.currency = o.currency;
  if (o.shippingMinor !== undefined) m.shipping_minor = o.shippingMinor;
  if (o.totalMinor !== undefined) m.total_minor = o.totalMinor;
  if (o.sgdPaidMinor !== undefined) m.sgd_paid_minor = o.sgdPaidMinor;
  if (o.estimated !== undefined) m.estimated = o.estimated;
  return m;
};

const PAGE = 1000; // PostgREST returns at most 1000 rows per request by default

export class SupabaseRepo implements Repo {
  constructor(private db: SupabaseClient) {}

  private async selectAll(table: string): Promise<Row[]> {
    const out: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const rows = ok(await this.db.from(table).select('*').range(from, from + PAGE - 1)) as Row[];
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }

  async loadAll(): Promise<Snapshot> {
    const [a, s, o, l, u] = await Promise.all(
      ['artists', 'sheets', 'orders', 'order_lines', 'usages'].map((t) => this.selectAll(t)),
    );
    return {
      artists: a.map(artistFrom), sheets: s.map(sheetFrom), orders: o.map(orderFrom),
      lines: l.map(lineFrom), usages: u.map(usageFrom),
    };
  }

  async createArtist(name: string): Promise<Artist> {
    return artistFrom(ok(await this.db.from('artists').insert({ name: name.trim() }).select().single()) as Row);
  }

  async mergeArtists(keepId: string, mergeId: string): Promise<void> {
    if (keepId === mergeId) throw new Error('Pick two different artists.');
    const rows = ok(await this.db.from('artists').select('*').in('id', [keepId, mergeId])) as Row[];
    const keep = rows.map(artistFrom).find((a) => a.id === keepId);
    const merge = rows.map(artistFrom).find((a) => a.id === mergeId);
    if (!keep || !merge) throw new Error('Artist not found.');
    ok(await this.db.from('sheets').update({ artist_id: keepId }).eq('artist_id', mergeId));
    const aliases = [...new Set([...keep.aliases, merge.name, ...merge.aliases])];
    ok(await this.db.from('artists').update({ aliases }).eq('id', keepId));
    ok(await this.db.from('artists').delete().eq('id', mergeId));
  }

  async createSheet(input: NewSheet): Promise<Sheet> {
    const row = {
      artist_id: input.artistId, title: input.title, tags: input.tags, photo_path: input.photoPath,
      thumb_path: input.thumbPath, photo_bytes: input.photoBytes, image_hash: input.imageHash,
    };
    return sheetFrom(ok(await this.db.from('sheets').insert(row).select().single()) as Row);
  }

  async updateSheet(id: string, patch: SheetPatch): Promise<void> {
    const m: Row = {};
    if (patch.artistId !== undefined) m.artist_id = patch.artistId;
    if (patch.title !== undefined) m.title = patch.title;
    if (patch.tags !== undefined) m.tags = patch.tags;
    ok(await this.db.from('sheets').update(m).eq('id', id));
  }

  async deleteSheet(id: string): Promise<void> {
    const affected = (ok(await this.db.from('order_lines').select('order_id').eq('sheet_id', id)) as Row[])
      .map((r) => r.order_id as string);
    ok(await this.db.from('sheets').delete().eq('id', id)); // cascades to lines and usages
    for (const orderId of new Set(affected)) {
      const left = ok(await this.db.from('order_lines').select('id').eq('order_id', orderId).limit(1)) as Row[];
      if (left.length === 0) ok(await this.db.from('orders').delete().eq('id', orderId));
    }
  }

  async createOrder(input: NewOrder): Promise<Order> {
    return orderFrom(ok(await this.db.from('orders').insert(orderTo(input)).select().single()) as Row);
  }

  async updateOrder(id: string, patch: Partial<NewOrder>): Promise<void> {
    ok(await this.db.from('orders').update(orderTo(patch)).eq('id', id));
  }

  async getOrCreateUnknownOrder(): Promise<Order> {
    const found = ok(await this.db.from('orders').select('*').eq('is_unknown', true).limit(1)) as Row[];
    if (found.length) return orderFrom(found[0]);
    return orderFrom(ok(await this.db.from('orders').insert({ is_unknown: true, currency: 'SGD' }).select().single()) as Row);
  }

  async addLine(input: NewLine): Promise<OrderLine> {
    const row = {
      order_id: input.orderId, sheet_id: input.sheetId, quantity: input.quantity,
      price_minor: input.priceMinor, estimated: input.estimated,
    };
    return lineFrom(ok(await this.db.from('order_lines').insert(row).select().single()) as Row);
  }

  async addUsage(sheetId: string, quantity: number, usedOn: string): Promise<Usage> {
    const lines = (ok(await this.db.from('order_lines').select('*').eq('sheet_id', sheetId)) as Row[]).map(lineFrom);
    const usages = (ok(await this.db.from('usages').select('*').eq('sheet_id', sheetId)) as Row[]).map(usageFrom);
    const err = usageError(sheetId, quantity, lines, usages);
    if (err) throw new Error(err);
    return usageFrom(ok(await this.db.from('usages').insert({ sheet_id: sheetId, quantity, used_on: usedOn }).select().single()) as Row);
  }

  async getShareLink(): Promise<ShareLink | null> {
    const rows = ok(await this.db.from('share_links').select('*').limit(1)) as Row[];
    return rows.length ? { token: rows[0].token as string, enabled: Boolean(rows[0].enabled) } : null;
  }

  async setShareLinkEnabled(enabled: boolean): Promise<ShareLink> {
    const current = await this.getShareLink();
    if (current) {
      ok(await this.db.from('share_links').update({ enabled }).eq('token', current.token));
      return { ...current, enabled };
    }
    const token = randomToken();
    ok(await this.db.from('share_links').insert({ token, enabled }));
    return { token, enabled };
  }

  async sharedCollection(token: string): Promise<SharedSheet[]> {
    const rows = ok(await this.db.rpc('shared_collection', { p_token: token })) as Row[];
    return rows.map((r) => ({
      sheetId: r.sheet_id as string, title: r.title as string,
      artist: (r.artist as string | null) ?? null, thumbPath: (r.thumb_path as string | null) ?? null,
    }));
  }
}

export class SupabasePhotoStore implements PhotoStore {
  /** userId may be '' for read-only use (shared view). */
  constructor(private db: SupabaseClient, private userId: string) {}

  async upload(kind: PhotoKind, blob: Blob): Promise<{ path: string; bytes: number }> {
    if (!this.userId) throw new Error('Not signed in.');
    const path = `${this.userId}/${crypto.randomUUID()}.jpg`;
    ok(await this.db.storage.from(kind).upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
    return { path, bytes: blob.size };
  }

  async url(kind: PhotoKind, path: string): Promise<string> {
    if (kind === 'thumbs') return this.db.storage.from('thumbs').getPublicUrl(path).data.publicUrl;
    const r = ok(await this.db.storage.from('photos').createSignedUrl(path, 3600)) as { signedUrl: string };
    return r.signedUrl;
  }

  async remove(kind: PhotoKind, paths: string[]): Promise<void> {
    if (paths.length) ok(await this.db.storage.from(kind).remove(paths));
  }
}
