import { EMPTY_ORDER_FORM, parseOrderForm, orderToForm } from '../../src/domain/orderForm';

test('parses the spec KRW example', () => {
  const r = parseOrderForm({
    ...EMPTY_ORDER_FORM, date: '2026-10-19', shop: 'JUIMJUIM', currency: 'KRW',
    shipping: '3000', total: '15000', sgdPaid: '15.60',
  });
  expect(r).toEqual({
    ok: true,
    value: {
      orderDate: '2026-10-19', shop: 'JUIMJUIM', currency: 'KRW',
      shippingMinor: 3000, totalMinor: 15000, sgdPaidMinor: 1560, estimated: false,
    },
  });
});

test('blank fields become null / zero', () => {
  const r = parseOrderForm(EMPTY_ORDER_FORM);
  expect(r).toEqual({
    ok: true,
    value: {
      orderDate: null, shop: null, currency: 'SGD',
      shippingMinor: 0, totalMinor: null, sgdPaidMinor: null, estimated: false,
    },
  });
});

test('invalid amounts give a field error', () => {
  expect(parseOrderForm({ ...EMPTY_ORDER_FORM, sgdPaid: '1.234' })).toEqual({ ok: false, error: 'SGD paid: not a valid amount.' });
  expect(parseOrderForm({ ...EMPTY_ORDER_FORM, currency: 'KRW', total: '3000.5' })).toEqual({ ok: false, error: 'Order total: not a valid amount.' });
});

test('orderToForm round-trips', () => {
  const form = orderToForm({
    id: 'o', orderDate: '2026-10-19', shop: null, currency: 'KRW', shippingMinor: 3000,
    totalMinor: 15000, sgdPaidMinor: 1560, estimated: true, isUnknown: false, createdAt: '',
  });
  expect(form).toEqual({
    date: '2026-10-19', shop: '', currency: 'KRW', shipping: '3000', total: '15000', sgdPaid: '15.60', estimated: true,
  });
});
