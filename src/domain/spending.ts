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

export function summarizeSpending(d: SpendingData): SpendingSummary {
  const artistName = new Map(d.artists.map((a) => [a.id, a.name]));
  const sheetArtist = new Map(
    d.sheets.map((s) => [s.id, (s.artistId && artistName.get(s.artistId)) || UNKNOWN_ARTIST]),
  );
  const byArtist = new Map<string, number>();
  const byMonth = new Map<string, number>();
  const missing: string[] = [];
  let total = 0, exact = 0, estimated = 0, shipping = 0, other = 0;

  for (const order of d.orders) {
    const ol = linesOf(order, d.lines);
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
