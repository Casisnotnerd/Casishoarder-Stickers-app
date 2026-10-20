import type { Artist, Order, OrderLine, Sheet, Usage } from './types';
import { normalizeText } from './text';
import { copiesOwned } from './holdings';
import { linesOf, unitSgdMinor } from './money';

export interface SheetFilter {
  text: string;
  artistId: string | null;
  tag: string | null;
  showUsedUp: boolean;
  dateFrom: string | null;
  dateTo: string | null;
  minSgdMinor: number | null;
  maxSgdMinor: number | null;
}

export const EMPTY_FILTER: SheetFilter = {
  text: '', artistId: null, tag: null, showUsedUp: false,
  dateFrom: null, dateTo: null, minSgdMinor: null, maxSgdMinor: null,
};

export interface FilterData {
  artists: Artist[];
  sheets: Sheet[];
  orders: Order[];
  lines: OrderLine[];
  usages: Usage[];
}

export function allTags(sheets: Sheet[]): string[] {
  return [...new Set(sheets.flatMap((s) => s.tags.map((t) => t.trim().toLowerCase())))].sort((a, b) => a.localeCompare(b));
}

export function filterSheets(f: SheetFilter, d: FilterData): Sheet[] {
  const artistById = new Map(d.artists.map((a) => [a.id, a]));
  const orderById = new Map(d.orders.map((o) => [o.id, o]));
  const q = normalizeText(f.text);
  const needsLines = f.dateFrom || f.dateTo || f.minSgdMinor !== null || f.maxSgdMinor !== null;

  return d.sheets
    .filter((s) => {
      if (!f.showUsedUp && copiesOwned(s.id, d.lines, d.usages) <= 0) return false;
      if (f.artistId && s.artistId !== f.artistId) return false;
      if (f.tag && !s.tags.some((t) => t.toLowerCase() === f.tag!.toLowerCase())) return false;
      if (q) {
        const a = s.artistId ? artistById.get(s.artistId) : undefined;
        const hay = [s.title, a?.name ?? '', ...(a?.aliases ?? []), ...s.tags].map(normalizeText);
        if (!hay.some((h) => h.includes(q))) return false;
      }
      if (needsLines) {
        const mine = d.lines.filter((l) => l.sheetId === s.id);
        const ok = mine.some((l) => {
          const o = orderById.get(l.orderId);
          if (!o) return false;
          if (f.dateFrom && (!o.orderDate || o.orderDate < f.dateFrom)) return false;
          if (f.dateTo && (!o.orderDate || o.orderDate > f.dateTo)) return false;
          if (f.minSgdMinor !== null || f.maxSgdMinor !== null) {
            const v = unitSgdMinor(l, o, linesOf(o, d.lines));
            if (v === null) return false;
            if (f.minSgdMinor !== null && v < f.minSgdMinor) return false;
            if (f.maxSgdMinor !== null && v > f.maxSgdMinor) return false;
          }
          return true;
        });
        if (!ok) return false;
      }
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
