import type { OrderLine, Usage } from './types';

export function copiesBought(sheetId: string, lines: OrderLine[]): number {
  return lines.filter((l) => l.sheetId === sheetId).reduce((n, l) => n + l.quantity, 0);
}

export function copiesUsed(sheetId: string, usages: Usage[]): number {
  return usages.filter((u) => u.sheetId === sheetId).reduce((n, u) => n + u.quantity, 0);
}

export function copiesOwned(sheetId: string, lines: OrderLine[], usages: Usage[]): number {
  return copiesBought(sheetId, lines) - copiesUsed(sheetId, usages);
}

export function usageError(sheetId: string, quantity: number, lines: OrderLine[], usages: Usage[]): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) return 'Enter a whole number of 1 or more.';
  const owned = copiesOwned(sheetId, lines, usages);
  if (quantity > owned) return `You only have ${owned} ${owned === 1 ? 'copy' : 'copies'}.`;
  return null;
}