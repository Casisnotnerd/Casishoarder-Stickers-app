import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { DataProvider } from '../../src/ui/DataProvider';
import { Spending } from '../../src/ui/pages/Spending';

test('shows total, exact/estimated and missing SGD count', async () => {
  const repo = new MemoryRepo();
  const a = await repo.createArtist('JUIMJUIM');
  const s = await repo.createSheet({ artistId: a.id, title: 'Egg', tags: [], photoPath: null, thumbPath: null, photoBytes: 0 , imageHash: null});
  const paid = await repo.createOrder({ orderDate: '2026-10-19', shop: null, currency: 'KRW', shippingMinor: 3000, totalMinor: 15000, sgdPaidMinor: 1560, estimated: false });
  const missing = await repo.createOrder({ orderDate: '2026-09-01', shop: null, currency: 'KRW', shippingMinor: 0, totalMinor: 3000, sgdPaidMinor: null, estimated: false });
  await repo.addLine({ orderId: paid.id, sheetId: s.id, quantity: 4, priceMinor: 3000, estimated: false });
  await repo.addLine({ orderId: missing.id, sheetId: s.id, quantity: 1, priceMinor: 3000, estimated: false });
  render(
    <MemoryRouter>
      <DataProvider repo={repo} photos={new MemoryPhotoStore()}><Spending /></DataProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByText(/1 order is missing the SGD amount/)).toBeTruthy();
  expect(screen.getByTestId('total').textContent).toMatch(/15\.60/);
  expect(screen.getByText('JUIMJUIM', { selector: 'span' })).toBeTruthy();
});
