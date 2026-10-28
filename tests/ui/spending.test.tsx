import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { DataProvider } from '../../src/ui/DataProvider';
import { Spending } from '../../src/ui/pages/Spending';
import { SpendingMonth } from '../../src/ui/pages/SpendingMonth';

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

async function yearsRepo() {
  const repo = new MemoryRepo();
  const a = await repo.createArtist('JUIMJUIM');
  const s = await repo.createSheet({ artistId: a.id, title: 'Egg', tags: [], photoPath: null, thumbPath: null, photoBytes: 0, imageHash: null });
  for (const [date, price] of [['2025-03-10', 1200], ['2026-10-05', 1560]] as const) {
    const o = await repo.createOrder({ orderDate: date, shop: null, currency: 'SGD', shippingMinor: 0, totalMinor: null, sgdPaidMinor: null, estimated: false });
    await repo.addLine({ orderId: o.id, sheetId: s.id, quantity: 1, priceMinor: price, estimated: false });
  }
  return repo;
}

function spendingApp(repo: MemoryRepo, path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <DataProvider repo={repo} photos={new MemoryPhotoStore()}>
        <Routes>
          <Route path="/spending" element={<Spending />} />
          <Route path="/spending/:month" element={<SpendingMonth />} />
          <Route path="/orders" element={<p>ORDERS</p>} />
        </Routes>
      </DataProvider>
    </MemoryRouter>,
  );
}

test('year switcher shows Jan–Dec of the chosen year and only spent months are links', async () => {
  spendingApp(await yearsRepo(), '/spending?year=2026');
  expect(await screen.findByText('S$15.60 this year')).toBeTruthy();
  expect(screen.getByText('2026')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Oct/ })).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Sep/ })).toBeNull();
  expect(screen.getByText('Sep')).toBeTruthy(); // still shown, greyed
  fireEvent.click(screen.getByLabelText('Previous year'));
  expect(await screen.findByText('S$12.00 this year')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Mar/ })).toBeTruthy();
  expect(screen.queryByLabelText('Previous year')).toBeNull();
  expect(screen.getByLabelText('Next year')).toBeTruthy();
});

test('tapping a month opens its page with the total and a bar per artist', async () => {
  spendingApp(await yearsRepo(), '/spending?year=2026');
  fireEvent.click(await screen.findByRole('link', { name: /Oct/ }));
  expect(await screen.findByRole('heading', { name: 'October 2026' })).toBeTruthy();
  expect(screen.getAllByText('S$15.60').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText('JUIMJUIM', { selector: 'span' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(await screen.findByText('S$15.60 this year')).toBeTruthy();
});

test('no-date orders show under the tiles', async () => {
  const repo = await yearsRepo();
  const s = (await repo.loadAll()).sheets[0];
  const o = await repo.createOrder({ orderDate: null, shop: null, currency: 'SGD', shippingMinor: 0, totalMinor: 900, sgdPaidMinor: null, estimated: false });
  await repo.addLine({ orderId: o.id, sheetId: s.id, quantity: 1, priceMinor: 900, estimated: false });
  spendingApp(repo, '/spending?year=2026');
  expect(await screen.findByText(/No date: S\$9\.00/)).toBeTruthy();
});

test('a bad month address shows not found', async () => {
  spendingApp(await yearsRepo(), '/spending/2026-13');
  expect(await screen.findByText("That month wasn't found.")).toBeTruthy();
});

test('artist bars use the artist colour on Spending and on the month page', async () => {
  const repo = await yearsRepo();
  const a = (await repo.loadAll()).artists[0];
  const { artistColor } = await import('../../src/domain/artistColor');
  spendingApp(repo, '/spending?year=2026');
  await screen.findByText('S$15.60 this year');
  const fill = () => (document.querySelector('.barrow .fill') as HTMLElement).style.getPropertyValue('--tab');
  expect(fill()).toBe(artistColor(a.id).ink);
  fireEvent.click(screen.getByRole('link', { name: /Oct/ }));
  await screen.findByRole('heading', { name: 'October 2026' });
  expect(fill()).toBe(artistColor(a.id).ink);
});
