import type { Artist, Order, OrderLine, Sheet } from './types';
import { effectiveSgdPaidMinor, lineSgdMinor, linesOf, shippingSgdMinor } from './money';

export interface SpendingData {
  artists: Artist[];
  sheets: Sheet[];
  orders: Order[];
  lines: OrderLine[];
}

export interface Bucket {
  label: string;
  minor: number;
}

export interface SpendingSummary {
  totalMinor: number;
  exactMinor: number;
  estimatedMinor: number;
  shippingMinor: number;
  otherMinor: number;
  byArtist: Bucket[];
  byMonth: Bucket[];
  missingSgdOrderIds: string[];
}

const UNKNOWN_ARTIST = 'Unknown artist';
const NO_DATE = 'No date';

function add(map: Map<string, number>, key: string, v: number) {
  map.set(key, (map.get(key) ?? 0) + v);
}

/**
 * `period` ('YYYY' or 'YYYY-MM') keeps only orders whose order date falls in it; orders without a date are left out.
 */
export function summarizeSpending(d: SpendingData, filterArtistId?: string | null, period?: string | null): SpendingSummary {
  const artistName = new Map(d.artists.map((a) => [a.id, a.name]));
  const sheetArtist = new Map(
    d.sheets.map((s) => [s.id, (s.artistId && artistName.get(s.artistId)) || UNKNOWN_ARTIST]),
  );
  const byArtist = new Map<string, number>();
  const byMonth = new Map<string, number>();
  const missing: string[] = [];
  let total = 0, exact = 0, estimated = 0, shipping = 0, other = 0;

  const filterSheets = filterArtistId
    ? new Set(d.sheets.filter((s) => s.artistId === filterArtistId).map((s) => s.id))
    : null;

  for (const order of d.orders) {
    if (period && !order.orderDate?.startsWith(period)) continue;
    const ol = linesOf(order, d.lines);
    const filteredOl = filterSheets ? ol.filter((l) => filterSheets.has(l.sheetId)) : ol;
    if (filteredOl.length === 0) continue;

    if (filterSheets) {
      let hasMissing = false;
      for (const l of filteredOl) {
        const v = lineSgdMinor(l, order, ol);
        if (v === null) { hasMissing = true; continue; }
        total += v;
        add(byMonth, order.orderDate ? order.orderDate.slice(0, 7) : NO_DATE, v);
        add(byArtist, sheetArtist.get(l.sheetId) ?? UNKNOWN_ARTIST, v);
        if (order.estimated || l.estimated) estimated += v;
        else exact += v;
      }
      if (hasMissing) missing.push(order.id);
      continue;
    }

    const paid = effectiveSgdPaidMinor(order, ol);
    if (paid === null) {
      if (!order.isUnknown) missing.push(order.id);
      continue;
    }
    total += paid;
    add(byMonth, order.orderDate ? order.orderDate.slice(0, 7) : NO_DATE, paid);
    let parts = 0;
    for (const l of ol) {
      const v = lineSgdMinor(l, order, ol);
      if (v === null) continue;
      parts += v;
      add(byArtist, sheetArtist.get(l.sheetId) ?? UNKNOWN_ARTIST, v);
      if (order.estimated || l.estimated) estimated += v;
      else exact += v;
    }
    const s = shippingSgdMinor(order, ol) ?? 0;
    parts += s;
    shipping += s;
    const rest = paid - parts;
    other += rest;
    if (order.estimated) estimated += s + rest;
    else exact += s + rest;
  }

  const toBuckets = (m: Map<string, number>) => [...m].map(([label, minor]) => ({ label, minor }));
  return {
    totalMinor: total,
    exactMinor: exact,
    estimatedMinor: estimated,
    shippingMinor: shipping,
    otherMinor: other,
    byArtist: toBuckets(byArtist).sort((a, b) => b.minor - a.minor),
    byMonth: toBuckets(byMonth).sort((a, b) =>
      a.label === NO_DATE ? 1 : b.label === NO_DATE ? -1 : a.label.localeCompare(b.label),
    ),
    missingSgdOrderIds: missing,
  };
}

/** Every year from the earliest dated order up to this year (just this year when nothing is dated). */
export function spendingYears(orders: Order[], now: Date = new Date()): number[] {
  const thisYear = now.getFullYear();
  const dated = orders.map((o) => o.orderDate).filter((x): x is string => !!x).map((x) => Number(x.slice(0, 4)));
  const first = Math.min(thisYear, ...dated);
  return Array.from({ length: thisYear - first + 1 }, (_, i) => first + i);
}

/** 'YYYY-01' … 'YYYY-12'. */
export function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

/** SGD paid on orders that have no order date (not part of any month). */
export function noDateSgdMinor(d: SpendingData): number {
  let sum = 0;
  for (const o of d.orders) {
    if (o.isUnknown || o.orderDate) continue;
    sum += effectiveSgdPaidMinor(o, linesOf(o, d.lines)) ?? 0;
  }
  return sum;
}
