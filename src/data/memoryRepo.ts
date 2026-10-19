import type { Artist, Order, OrderLine, Sheet, ShareLink, Usage } from '../domain/types';
import { copiesOwned, usageError } from '../domain/holdings';
import type { NewLine, NewOrder, NewSheet, PhotoKind, PhotoStore, Repo, SharedSheet, SheetPatch, Snapshot } from './repo';
import { randomToken } from './token';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export class MemoryRepo implements Repo {
  private n = 0;
  private s: Snapshot = { artists: [], sheets: [], orders: [], lines: [], usages: [] };
  private share: ShareLink | null = null;

  private nextId(prefix: string): string {
    this.n += 1;
    return `${prefix}-${this.n}`;
  }

  private stamp(): string {
    return new Date(Date.UTC(2026, 0, 1) + this.n * 1000).toISOString();
  }

  async loadAll(): Promise<Snapshot> {
    return clone(this.s);
  }

  async createArtist(name: string): Promise<Artist> {
    const a: Artist = { id: this.nextId('artist'), name: name.trim(), aliases: [] };
    this.s.artists.push(a);
    return clone(a);
  }

  async mergeArtists(keepId: string, mergeId: string): Promise<void> {
    if (keepId === mergeId) throw new Error('Pick two different artists.');
    const keep = this.s.artists.find((a) => a.id === keepId);
    const merge = this.s.artists.find((a) => a.id === mergeId);
    if (!keep || !merge) throw new Error('Artist not found.');
    for (const sh of this.s.sheets) if (sh.artistId === mergeId) sh.artistId = keepId;
    keep.aliases = [...new Set([...keep.aliases, merge.name, ...merge.aliases])];
    this.s.artists = this.s.artists.filter((a) => a.id !== mergeId);
  }

  async createSheet(input: NewSheet): Promise<Sheet> {
    const id = this.nextId('sheet');
    const sh: Sheet = { ...input, id, createdAt: this.stamp() };
    this.s.sheets.push(sh);
    return clone(sh);
  }

  async updateSheet(id: string, patch: SheetPatch): Promise<void> {
    const sh = this.s.sheets.find((x) => x.id === id);
    if (!sh) throw new Error('Sheet not found.');
    Object.assign(sh, patch);
  }

  async deleteSheet(id: string): Promise<void> {
    const affected = new Set(this.s.lines.filter((l) => l.sheetId === id).map((l) => l.orderId));
    this.s.lines = this.s.lines.filter((l) => l.sheetId !== id);
    this.s.usages = this.s.usages.filter((u) => u.sheetId !== id);
    this.s.sheets = this.s.sheets.filter((x) => x.id !== id);
    this.s.orders = this.s.orders.filter(
      (o) => !affected.has(o.id) || this.s.lines.some((l) => l.orderId === o.id),
    );
  }

  async createOrder(input: NewOrder): Promise<Order> {
    const id = this.nextId('order');
    const o: Order = { ...input, id, isUnknown: false, createdAt: this.stamp() };
    this.s.orders.push(o);
    return clone(o);
  }

  async updateOrder(id: string, patch: Partial<NewOrder>): Promise<void> {
    const o = this.s.orders.find((x) => x.id === id);
    if (!o) throw new Error('Order not found.');
    Object.assign(o, patch);
  }

  async getOrCreateUnknownOrder(): Promise<Order> {
    const existing = this.s.orders.find((o) => o.isUnknown);
    if (existing) return clone(existing);
    const id = this.nextId('order');
    const o: Order = {
      id, orderDate: null, shop: null, currency: 'SGD', shippingMinor: 0, totalMinor: null,
      sgdPaidMinor: null, estimated: false, isUnknown: true, createdAt: this.stamp(),
    };
    this.s.orders.push(o);
    return clone(o);
  }

  async addLine(input: NewLine): Promise<OrderLine> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error('Quantity must be 1 or more.');
    const l: OrderLine = { ...input, id: this.nextId('line') };
    this.s.lines.push(l);
    return clone(l);
  }

  async addUsage(sheetId: string, quantity: number, usedOn: string): Promise<Usage> {
    const err = usageError(sheetId, quantity, this.s.lines, this.s.usages);
    if (err) throw new Error(err);
    const u: Usage = { id: this.nextId('usage'), sheetId, quantity, usedOn };
    this.s.usages.push(u);
    return clone(u);
  }

  async getShareLink(): Promise<ShareLink | null> {
    return this.share ? clone(this.share) : null;
  }

  async setShareLinkEnabled(enabled: boolean): Promise<ShareLink> {
    if (!this.share) this.share = { token: randomToken(), enabled };
    else this.share.enabled = enabled;
    return clone(this.share);
  }

  async sharedCollection(token: string): Promise<SharedSheet[]> {
    if (!this.share || !this.share.enabled || this.share.token !== token) return [];
    const name = new Map(this.s.artists.map((a) => [a.id, a.name]));
    return this.s.sheets
      .filter((sh) => copiesOwned(sh.id, this.s.lines, this.s.usages) > 0)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((sh) => ({
        sheetId: sh.id,
        title: sh.title,
        artist: sh.artistId ? name.get(sh.artistId) ?? null : null,
        thumbPath: sh.thumbPath,
      }));
  }
}

export class MemoryPhotoStore implements PhotoStore {
  private n = 0;
  private urls = new Map<string, string>();

  async upload(kind: PhotoKind, blob: Blob): Promise<{ path: string; bytes: number }> {
    this.n += 1;
    const path = `${kind}/mem-${this.n}.jpg`;
    this.urls.set(path, URL.createObjectURL(blob));
    return { path, bytes: blob.size };
  }

  async url(_kind: PhotoKind, path: string): Promise<string> {
    return this.urls.get(path) ?? '';
  }

  async remove(_kind: PhotoKind, paths: string[]): Promise<void> {
    for (const p of paths) {
      const u = this.urls.get(p);
      if (u) URL.revokeObjectURL(u);
      this.urls.delete(p);
    }
  }
}