import type { Order } from './types';
import { minorToInput, toMinor } from './currency';

export interface OrderForm {
  date: string;
  shop: string;
  currency: string;
  shipping: string;
  total: string;
  sgdPaid: string;
  estimated: boolean;
}

export const EMPTY_ORDER_FORM: OrderForm = {
  date: '', shop: '', currency: 'SGD', shipping: '', total: '', sgdPaid: '', estimated: false,
};

export interface ParsedOrder {
  orderDate: string | null;
  shop: string | null;
  currency: string;
  shippingMinor: number;
  totalMinor: number | null;
  sgdPaidMinor: number | null;
  estimated: boolean;
}

export type ParseResult = { ok: true; value: ParsedOrder } | { ok: false; error: string };

function amount(label: string, s: string, currency: string): { v: number | null } | { error: string } {
  if (!s.trim()) return { v: null };
  const v = toMinor(s, currency);
  return v === null ? { error: `${label}: not a valid amount.` } : { v };
}

export function parseOrderForm(f: OrderForm): ParseResult {
  const currency = f.currency.toUpperCase();
  const shipping = amount('Shipping', f.shipping, currency);
  if ('error' in shipping) return { ok: false, error: shipping.error };
  const total = amount('Order total', f.total, currency);
  if ('error' in total) return { ok: false, error: total.error };
  const paid = amount('SGD paid', f.sgdPaid, 'SGD');
  if ('error' in paid) return { ok: false, error: paid.error };
  return {
    ok: true,
    value: {
      orderDate: f.date.trim() || null,
      shop: f.shop.trim() || null,
      currency,
      shippingMinor: shipping.v ?? 0,
      totalMinor: total.v,
      sgdPaidMinor: paid.v,
      estimated: f.estimated,
    },
  };
}

export function orderToForm(o: Order): OrderForm {
  return {
    date: o.orderDate ?? '',
    shop: o.shop ?? '',
    currency: o.currency,
    shipping: o.shippingMinor ? minorToInput(o.shippingMinor, o.currency) : '',
    total: o.totalMinor === null ? '' : minorToInput(o.totalMinor, o.currency),
    sgdPaid: o.sgdPaidMinor === null ? '' : minorToInput(o.sgdPaidMinor, 'SGD'),
    estimated: o.estimated,
  };
}
