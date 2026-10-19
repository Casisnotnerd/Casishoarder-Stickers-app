import type { Artist, Order, OrderLine, Sheet, ShareLink, Usage } from '../domain/types';
import type { NewLine, NewOrder, NewSheet, PhotoKind, PhotoStore, Repo, SharedSheet, SheetPatch, Snapshot } from './repo';
import { supabase } from './supabaseClient';

function client() {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

function rowToArtist(r: any): Artist {
  return { id: r.id, name: r.name, aliases: r.aliases ?? [] };
}
function rowToSheet(r: any): Sheet {
  return {
    id: r.id, artistId: r.artist_id, title: r.title, tags: r.tags ?? [],
    photoPath: r.photo_path, thumbPath: r.thumb_path, photoBytes: r.photo_bytes ?? 0, createdAt: r.created_at,
  };
}
function rowToOrder(r: any): Order {
  return {
    id: r.id, orderDate: r.order_date, shop: r.shop, currency: r.currency,
    shippingMinor: Number(r.shipping_minor), totalMinor: r.total_minor === null ? null : Number(r.total_minor),
    sgdPaidMinor: r.sgd_paid_minor === null ? null : Number(r.sgd_paid_minor),
    estimated: r.estimated, isUnknown: r.is_unknown, createdAt: r.created_at,
  };
}
function rowToLine(r: any): OrderLine {
  return {
    id: r.id, orderId: r.order_id, sheetId: r.sheet_id, quantity: r.quantity,
    priceMinor: r.price_minor === null ? null : Number(r.price_minor), estimated: r.estimated,
  };
}
function rowToUsage(r: any): Usage {
  return { id: r.id, sheetId: r.sheet_id, quantity: r.quantity, usedOn: r.used_on };
}

export class SupabaseRepo implements Repo {
  async loadAll(): Promise<Snapshot> {
    const c = client();
    const [a, s, o, l, u] = await Promise.all([
      c.from('artists').select('*'),
      c.from('sheets').select('*'),
      c.from('orders').select('*'),
      c.from('order_lines').select('*'),
      c.from('usages').select('*'),
    ]);
    const err = a.error || s.error || o.error || l.error || u.error;
    if (err) throw new Error('load failed: ' + (err.message ?? JSON.stringify(err)));
    return {
      artists: (a.data ?? []).map(rowToArtist),
      sheets: (s.data ?? []).map(rowToSheet),
      orders: (o.data ?? []).map(rowToOrder),
      lines: (l.data ?? []).map(rowToLine),
      usages: (u.data ?? []).map(rowToUsage),
    };
  }

  async createArtist(name: string): Promise<Artist> {
    const c = client();
    const { data, error } = await c.from('artists').insert({ name: name.trim() }).select().single();
    if (error || !data) throw new Error(error?.message ?? 'create artist failed');
    return rowToArtist(data);
  }

  async mergeArtists(keepId: string, mergeId: string): Promise<void> {
    if (keepId === mergeId) throw new Error('Pick two different artists.');
    const c = client();
    const { data: keep } = await c.from('artists').select('*').eq('id', keepId).single();
    const { data: merge } = await c.from('artists').select('*').eq('id', mergeId).single();
    if (!keep || !merge) throw new Error('Artist not found.');
    await c.from('sheets').update({ artist_id: keepId }).eq('artist_id', mergeId);
    const aliases = [...new Set([...(keep.aliases ?? []), merge.name, ...(merge.aliases ?? [])])];
    await c.from('artists').update({ aliases }).eq('id', keepId);
    await c.from('artists').delete().eq('id', mergeId);
  }

  async createSheet(input: NewSheet): Promise<Sheet> {
    const c = client();
    const { data, error } = await c.from('sheets').insert({
      artist_id: input.artistId, title: input.title, tags: input.tags,
      photo_path: input.photoPath, thumb_path: input.thumbPath, photo_bytes: input.photoBytes,
    }).select().single();
    if (error || !data) throw new Error(error?.message ?? 'create sheet failed');
    return rowToSheet(data);
  }

  async updateSheet(id: string, patch: SheetPatch): Promise<void> {
    const c = client();
    const row: any = {};
    if (patch.artistId !== undefined) row.artist_id = patch.artistId;
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.tags !== undefined) row.tags = patch.tags;
    const { error } = await c.from('sheets').update(row).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteSheet(id: string): Promise<void> {
    const c = client();
    // delete lines/usages handled by cascade; but orders left empty need removal
    const { data: affected } = await c.from('order_lines').select('order_id').eq('sheet_id', id);
    const orderIds = [...new Set((affected ?? []).map((r: any) => r.order_id))];
    await c.from('sheets').delete().eq('id', id);
    for (const oid of orderIds) {
      const { data: remaining } = await c.from('order_lines').select('id').eq('order_id', oid);
      if (!remaining || remaining.length === 0) {
        await c.from('orders').delete().eq('id', oid);
      }
    }
  }

  async createOrder(input: NewOrder): Promise<Order> {
    const c = client();
    const { data, error } = await c.from('orders').insert({
      order_date: input.orderDate, shop: input.shop, currency: input.currency,
      shipping_minor: input.shippingMinor, total_minor: input.totalMinor,
      sgd_paid_minor: input.sgdPaidMinor, estimated: input.estimated,
    }).select().single();
    if (error || !data) throw new Error(error?.message ?? 'create order failed');
    return rowToOrder(data);
  }

  async updateOrder(id: string, patch: Partial<NewOrder>): Promise<void> {
    const c = client();
    const row: any = {};
    if (patch.orderDate !== undefined) row.order_date = patch.orderDate;
    if (patch.shop !== undefined) row.shop = patch.shop;
    if (patch.currency !== undefined) row.currency = patch.currency;
    if (patch.shippingMinor !== undefined) row.shipping_minor = patch.shippingMinor;
    if (patch.totalMinor !== undefined) row.total_minor = patch.totalMinor;
    if (patch.sgdPaidMinor !== undefined) row.sgd_paid_minor = patch.sgdPaidMinor;
    if (patch.estimated !== undefined) row.estimated = patch.estimated;
    const { error } = await c.from('orders').update(row).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async getOrCreateUnknownOrder(): Promise<Order> {
    const c = client();
    const { data: existing } = await c.from('orders').select('*').eq('is_unknown', true).maybeSingle();
    if (existing) return rowToOrder(existing);
    const { data, error } = await c.from('orders').insert({
      currency: 'SGD', is_unknown: true,
    }).select().single();
    if (error || !data) throw new Error(error?.message ?? 'create unknown order failed');
    return rowToOrder(data);
  }

  async addLine(input: NewLine): Promise<OrderLine> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error('Quantity must be 1 or more.');
    const c = client();
    const { data, error } = await c.from('order_lines').insert({
      order_id: input.orderId, sheet_id: input.sheetId, quantity: input.quantity,
      price_minor: input.priceMinor, estimated: input.estimated,
    }).select().single();
    if (error || !data) throw new Error(error?.message ?? 'add line failed');
    return rowToLine(data);
  }

  async addUsage(sheetId: string, quantity: number, usedOn: string): Promise<Usage> {
    const c = client();
    // validation done client-side via holdings; trust here
    const { data, error } = await c.from('usages').insert({
      sheet_id: sheetId, quantity, used_on: usedOn,
    }).select().single();
    if (error || !data) throw new Error(error?.message ?? 'add usage failed');
    return rowToUsage(data);
  }

  async getShareLink(): Promise<ShareLink | null> {
    const c = client();
    const { data } = await c.from('share_links').select('*').maybeSingle();
    if (!data) return null;
    return { token: data.token, enabled: data.enabled };
  }

  async setShareLinkEnabled(enabled: boolean): Promise<ShareLink> {
    const c = client();
    const existing = await this.getShareLink();
    if (existing) {
      const { data, error } = await c.from('share_links').update({ enabled }).eq('token', existing.token).select().single();
      if (error || !data) throw new Error(error?.message ?? 'update share failed');
      return { token: data.token, enabled: data.enabled };
    }
    const token = (await import('./token')).randomToken();
    const { data, error } = await c.from('share_links').insert({ token, enabled }).select().single();
    if (error || !data) throw new Error(error?.message ?? 'create share failed');
    return { token: data.token, enabled: data.enabled };
  }

  async sharedCollection(token: string): Promise<SharedSheet[]> {
    const c = client();
    const { data, error } = await c.rpc('shared_collection', { p_token: token });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      sheetId: r.sheet_id, title: r.title, artist: r.artist, thumbPath: r.thumb_path,
    }));
  }
}

export class SupabasePhotoStore implements PhotoStore {
  private c: any;
  constructor(c?: any) { this.c = c ?? null; }
  private sb() { return this.c ?? client(); }
  async upload(kind: PhotoKind, blob: Blob): Promise<{ path: string; bytes: number }> {
    const c = this.sb();
    const { data: { user } } = await c.auth.getUser();
    const uid = user?.id ?? 'anon';
    const path = `${uid}/${crypto.randomUUID()}.jpg`;
    const bucket = kind;
    const { error } = await c.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw new Error(error.message);
    return { path, bytes: blob.size };
  }
  async url(kind: PhotoKind, path: string): Promise<string> {
    const c = this.sb();
    if (kind === 'thumbs') {
      const { data } = c.storage.from(kind).getPublicUrl(path);
      return data.publicUrl;
    }
    const { data, error } = await c.storage.from(kind).createSignedUrl(path, 3600);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  }
  async remove(kind: PhotoKind, paths: string[]): Promise<void> {
    const c = this.sb();
    if (paths.length) await c.storage.from(kind).remove(paths);
  }
}