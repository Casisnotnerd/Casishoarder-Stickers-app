import type { Order, OrderLine } from './types';
import { exponent } from './currency';

export function linesOf(order: Order, lines: OrderLine[]): OrderLine[] {
  return lines.filter((l) => l.orderId === order.id);
}

export function itemsSumMinor(orderLines: OrderLine[]): number | null {
  let sum = 0;
  for (const l of orderLines) {
    if (l.priceMinor === null) return null;
    sum += l.priceMinor * l.quantity;
  }
  return sum;
}

export function rateBaseMinor(order: Order, orderLines: OrderLine[]): number | null {
  if (order.totalMinor !== null) return order.totalMinor > 0 ? order.totalMinor : null;
  const items = itemsSumMinor(orderLines);
  if (items === null) return null;
  const base = items + order.shippingMinor;
  return base > 0 ? base : null;
}

export function effectiveSgdPaidMinor(order: Order, orderLines: OrderLine[]): number | null {
  if (order.sgdPaidMinor !== null) return order.sgdPaidMinor;
  if (order.currency.toUpperCase() !== 'SGD') return null;
  if (order.totalMinor !== null) return order.totalMinor;
  const items = itemsSumMinor(orderLines);
  return items === null ? null : items + order.shippingMinor;
}

function convert(amountMinor: number, order: Order, orderLines: OrderLine[]): number | null {
  const paid = effectiveSgdPaidMinor(order, orderLines);
  const base = rateBaseMinor(order, orderLines);
  if (paid === null || base === null) return null;
  return Math.round((amountMinor * paid) / base);
}

export function lineSgdMinor(line: OrderLine, order: Order, orderLines: OrderLine[]): number | null {
  return line.priceMinor === null ? null : convert(line.priceMinor * line.quantity, order, orderLines);
}

export function unitSgdMinor(line: OrderLine, order: Order, orderLines: OrderLine[]): number | null {
  return line.priceMinor === null ? null : convert(line.priceMinor, order, orderLines);
}

export function shippingSgdMinor(order: Order, orderLines: OrderLine[]): number | null {
  return convert(order.shippingMinor, order, orderLines);
}

/** SGD per 1 unit of the order currency (e.g. 0.00104 SGD per ₩1). */
export function derivedRate(order: Order, orderLines: OrderLine[]): number | null {
  const paid = effectiveSgdPaidMinor(order, orderLines);
  const base = rateBaseMinor(order, orderLines);
  if (paid === null || base === null) return null;
  return paid / 100 / (base / 10 ** exponent(order.currency));
}

export interface Mismatch {
  expectedMinor: number;
  totalMinor: number;
  diffMinor: number;
}

export function orderMismatch(order: Order, orderLines: OrderLine[]): Mismatch | null {
  if (order.totalMinor === null) return null;
  const items = itemsSumMinor(orderLines);
  if (items === null) return null;
  const expected = items + order.shippingMinor;
  if (expected === order.totalMinor) return null;
  return { expectedMinor: expected, totalMinor: order.totalMinor, diffMinor: order.totalMinor - expected };
}
