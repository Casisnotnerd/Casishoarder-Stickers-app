import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { DataProvider } from '../../src/ui/DataProvider';
import { SheetDetail } from '../../src/ui/pages/SheetDetail';

async function setup() {
  const repo = new MemoryRepo();
  const s = await repo.createSheet({ artistId: null, title: 'Winter', tags: [], photoPath: null, thumbPath: null, photoBytes: 0 , imageHash: null});
  const o = await repo.createOrder({ orderDate: '2026-10-19', shop: 'papermilio', currency: 'SGD', shippingMinor: 0, totalMinor: null, sgdPaidMinor: null, estimated: false });
  await repo.addLine({ orderId: o.id, sheetId: s.id, quantity: 3, priceMinor: 450, estimated: false });
  render(
    <MemoryRouter initialEntries={[`/sheet/${s.id}`]}>
      <DataProvider repo={repo} photos={new MemoryPhotoStore()}>
        <Routes>
          <Route path="/sheet/:id" element={<SheetDetail />} />
          <Route path="/" element={<p>HOME</p>} />
        </Routes>
      </DataProvider>
    </MemoryRouter>,
  );
  return repo;
}

test('used up reduces copies and keeps history', async () => {
  const repo = await setup();
  expect(await screen.findByLabelText('Own: 3 copies')).toBeTruthy();
  fireEvent.click(screen.getByText('Mark used up'));
  expect(await screen.findByLabelText('Own: 2 copies')).toBeTruthy();
  expect((await repo.loadAll()).usages).toHaveLength(1);
});

test('delete asks for confirmation, then removes the sheet', async () => {
  const repo = await setup();
  await screen.findByLabelText('Own: 3 copies');
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByText('Delete sheet'));
  expect(confirmSpy.mock.calls[0][0]).toContain('1 order line');
  expect(await screen.findByText('HOME')).toBeTruthy();
  await waitFor(async () => expect((await repo.loadAll()).sheets).toHaveLength(0));
  confirmSpy.mockRestore();
});
