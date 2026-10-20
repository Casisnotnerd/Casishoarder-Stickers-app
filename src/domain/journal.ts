import type { OrderLine, Sheet, Usage } from './types';
import { copiesOwned } from './holdings';

/** Calendar day (YYYY-MM-DD) of an instant in a time zone (default: the device's). */
function dayKey(d: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function addedLabel(createdAt: string, now: Date = new Date(), timeZone?: string): 'Today' | 'Yesterday' | null {
  const day = dayKey(new Date(createdAt), timeZone);
  if (day === dayKey(now, timeZone)) return 'Today';
  if (day === dayKey(new Date(now.getTime() - 86_400_000), timeZone)) return 'Yesterday';
  return null;
}

export function addedThisMonth(sheets: Sheet[], now: Date = new Date(), timeZone?: string): number {
  const month = dayKey(now, timeZone).slice(0, 7);
  return sheets.filter((s) => dayKey(new Date(s.createdAt), timeZone).slice(0, 7) === month).length;
}

export type SortOrder = 'newest' | 'oldest' | 'az' | 'copies';

export const SORT_LABELS: Record<SortOrder, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  az: 'A to Z',
  copies: 'Most copies',
};

export function sortSheets(sheets: Sheet[], order: SortOrder, lines: OrderLine[], usages: Usage[]): Sheet[] {
  const out = [...sheets];
  switch (order) {
    case 'newest': return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'oldest': return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case 'az': return out.sort((a, b) => a.title.localeCompare(b.title));
    case 'copies': {
      const n = new Map(out.map((s) => [s.id, copiesOwned(s.id, lines, usages)]));
      return out.sort((a, b) => (n.get(b.id)! - n.get(a.id)!) || b.createdAt.localeCompare(a.createdAt));
    }
  }
}
