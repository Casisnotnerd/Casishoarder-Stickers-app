import type { Artist, Order, OrderLine, Sheet, ShareLink, Usage } from '../domain/types';

export interface Snapshot {
  artists: Artist[];
  sheets: Sheet[];
  orders: Order[];
  lines: OrderLine[];
  usages: Usage[];
}

export type NewSheet = Omit<Sheet, 'id' | 'createdAt'>;
export type SheetPatch = Partial<Pick<Sheet, 'artistId' | 'title' | 'tags'>>;
export type ArtistPatch = Partial<Pick<Artist, 'name' | 'aliases' | 'avatarPath' | 'avatarBytes' | 'avatarPosition'>>;
export type NewOrder = Omit<Order, 'id' | 'createdAt' | 'isUnknown'>;
export type NewLine = Omit<OrderLine, 'id'>;

export interface SharedSheet {
  sheetId: string;
  title: string;
  artist: string | null;
  thumbPath: string | null;
}

export interface Repo {
  loadAll(): Promise<Snapshot>;
  createArtist(name: string): Promise<Artist>;
  updateArtist(id: string, patch: ArtistPatch): Promise<void>;
  mergeArtists(keepId: string, mergeId: string): Promise<void>;
  createSheet(input: NewSheet): Promise<Sheet>;
  updateSheet(id: string, patch: SheetPatch): Promise<void>;
  /** Deletes the sheet, its order lines and usages, and any order left with no lines. */
  deleteSheet(id: string): Promise<void>;
  createOrder(input: NewOrder): Promise<Order>;
  updateOrder(id: string, patch: Partial<NewOrder>): Promise<void>;
  getOrCreateUnknownOrder(): Promise<Order>;
  addLine(input: NewLine): Promise<OrderLine>;
  updateLine(id: string, patch: { quantity?: number; priceMinor?: number | null; estimated?: boolean }): Promise<void>;
  addUsage(sheetId: string, quantity: number, usedOn: string): Promise<Usage>;
  getShareLink(): Promise<ShareLink | null>;
  setShareLinkEnabled(enabled: boolean): Promise<ShareLink>;
  sharedCollection(token: string): Promise<SharedSheet[]>;
}

export type PhotoKind = 'photos' | 'thumbs';

export interface PhotoStore {
  upload(kind: PhotoKind, blob: Blob): Promise<{ path: string; bytes: number }>;
  url(kind: PhotoKind, path: string): Promise<string>;
  remove(kind: PhotoKind, paths: string[]): Promise<void>;
}
