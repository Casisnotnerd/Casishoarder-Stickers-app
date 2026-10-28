import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { DataProvider } from '../../src/ui/DataProvider';
import { SearchStateProvider, useScrollMemory } from '../../src/ui/SearchState';
import { Collection } from '../../src/ui/pages/Collection';
import { SheetDetail } from '../../src/ui/pages/SheetDetail';

test('search is kept after opening a sheet and coming back', async () => {
  const repo = new MemoryRepo();
  const o = await repo.getOrCreateUnknownOrder();
  for (const title of ['Winter', 'Spring']) {
    const s = await repo.createSheet({ artistId: null, title, tags: [], photoPath: null, thumbPath: null, photoBytes: 0, imageHash: null });
    await repo.addLine({ orderId: o.id, sheetId: s.id, quantity: 1, priceMinor: null, estimated: false });
  }
  render(
    <DataProvider repo={repo} photos={new MemoryPhotoStore()}>
      <MemoryRouter initialEntries={['/search']}>
        <SearchStateProvider>
          <Routes>
            <Route path="/search" element={<Collection searchMode />} />
            <Route path="/sheet/:id" element={<SheetDetail />} />
          </Routes>
        </SearchStateProvider>
      </MemoryRouter>
    </DataProvider>,
  );
  fireEvent.change(await screen.findByPlaceholderText('Find a sticker, artist or tag'), { target: { value: 'win' } });
  fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'az' } });
  fireEvent.click(screen.getByText('Winter'));
  fireEvent.click(await screen.findByRole('button', { name: 'Back' }));
  expect((await screen.findByPlaceholderText('Find a sticker, artist or tag') as HTMLInputElement).value).toBe('win');
  expect((screen.getByLabelText('Sort') as HTMLSelectElement).value).toBe('az');
  expect(screen.queryByText('Spring')).toBeNull();
});

function Page() {
  useScrollMemory('k');
  return <p>PAGE</p>;
}

test('scroll position is restored when coming back', async () => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
  const first = render(<Page />);
  Object.defineProperty(window, 'scrollY', { value: 640, configurable: true });
  first.unmount();
  const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(<Page />);
  act(() => { vi.advanceTimersToNextFrame(); });
  expect(spy).toHaveBeenCalledWith(0, 640);
  spy.mockRestore();
  vi.useRealTimers();
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});
