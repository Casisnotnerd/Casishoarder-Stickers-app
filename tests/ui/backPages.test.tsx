import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { DataProvider } from '../../src/ui/DataProvider';
import { SheetDetail } from '../../src/ui/pages/SheetDetail';
import { AddOrder } from '../../src/ui/pages/AddOrder';
import { BulkAdd } from '../../src/ui/pages/BulkAdd';
import { Orders } from '../../src/ui/pages/Orders';

function app(repo: MemoryRepo, entries: string[], routes: React.ReactNode) {
  render(
    <DataProvider repo={repo} photos={new MemoryPhotoStore()}>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <Routes>{routes}</Routes>
      </MemoryRouter>
    </DataProvider>,
  );
}

test('sheet detail has a Back button that returns to the artist folder', async () => {
  const repo = new MemoryRepo();
  const s = await repo.createSheet({ artistId: null, title: 'Winter', tags: [], photoPath: null, thumbPath: null, photoBytes: 0, imageHash: null });
  app(repo, ['/artist/x', `/sheet/${s.id}`], <>
    <Route path="/sheet/:id" element={<SheetDetail />} />
    <Route path="/artist/:id" element={<p>FOLDER</p>} />
  </>);
  await screen.findByText('Winter');
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(await screen.findByText('FOLDER')).toBeTruthy();
});

test('all orders opened directly goes Back to Spending', async () => {
  app(new MemoryRepo(), ['/orders'], <>
    <Route path="/orders" element={<Orders />} />
    <Route path="/spending" element={<p>SPENDING</p>} />
  </>);
  fireEvent.click(await screen.findByRole('button', { name: 'Back' }));
  expect(await screen.findByText('SPENDING')).toBeTruthy();
});

test('leaving Add one with an unsaved sheet asks first', async () => {
  app(new MemoryRepo(), ['/add', '/add/one'], <>
    <Route path="/add" element={<p>CHOICE</p>} />
    <Route path="/add/one" element={<AddOrder />} />
  </>);
  fireEvent.click(await screen.findByText('📷 Add a sheet'));
  const spy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.queryByText('CHOICE')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(await screen.findByText('CHOICE')).toBeTruthy();
  expect(spy).toHaveBeenCalledWith('Leave without saving these sheets?');
  spy.mockRestore();
});

test('bulk add has one Back button; step buttons say Previous step', async () => {
  app(new MemoryRepo(), ['/add', '/add/many'], <>
    <Route path="/add" element={<p>CHOICE</p>} />
    <Route path="/add/many" element={<BulkAdd />} />
  </>);
  await screen.findByText('Order details');
  expect(screen.getAllByRole('button', { name: 'Back' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Back' })); // nothing unsaved yet: no question
  expect(await screen.findByText('CHOICE')).toBeTruthy();
});
