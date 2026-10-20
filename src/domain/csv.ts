import type { Artist, Order, OrderLine, Sheet, Usage } from './types';
import { minorToInput } from './currency';
import { copiesOwned } from './holdings';
import { linesOf, unitSgdMinor } from './money';

type Cell = string | number | null;

export function csvEscape(v: Cell): string {
  if (v === null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Cell[][]): string {
  return '﻿' + rows.map((r) => r.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

export interface CsvData {
  artists: Artist[];
  sheets: Sheet[];
  orders: Order[];
  lines: OrderLine[];
  usages: Usage[];
}

export function collectionCsv(d: CsvData): string {
  const artistName = new Map(d.artists.map((a) => [a.id, a.name]));
  const orderById = new Map(d.orders.map((o) => [o.id, o]));
  const rows: Cell[][] = [[
    'Title', 'Artist', 'Tags', 'Copies owned', 'Order date', 'Shop', 'Currency',
    'Quantity', 'Price each', 'Price each (SGD)', 'Estimated',
  ]];
  const sorted = [...d.sheets].sort((a, b) => a.title.localeCompare(b.title));
  for (const s of sorted) {
    const head: Cell[] = [
      s.title,
      s.artistId ? artistName.get(s.artistId) ?? '' : '',
      s.tags.join('; '),
      copiesOwned(s.id, d.lines, d.usages),
    ];
    const mine = d.lines.filter((l) => l.sheetId === s.id);
    if (mine.length === 0) {
      rows.push([...head, null, null, null, null, null, null, null]);
      continue;
    }
    for (const l of mine) {
      const o = orderById.get(l.orderId);
      if (!o) continue;
      const sgd = unitSgdMinor(l, o, linesOf(o, d.lines));
      rows.push([
        ...head,
        o.orderDate,
        o.shop,
        o.currency,
        l.quantity,
        l.priceMinor === null ? null : minorToInput(l.priceMinor, o.currency),
        sgd === null ? null : minorToInput(sgd, 'SGD'),
        o.estimated || l.estimated ? 'yes' : 'no',
      ]);
    }
  }
  return toCsv(rows);
}
