import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { DataProvider } from '../../src/ui/DataProvider';
import { Collection } from '../../src/ui/pages/Collection';

async function seed() {
  const r = new MemoryRepo();
  const a = await r.createArtist('papermilio');
  const w = await r.createSheet({ artistId: a.id, title: 'Winter', tags: ['seasonal'], photoPath: null, thumbPath: null, photoBytes: 0 , imageHash: null});
  const s = await r.createSheet({ artistId: a.id, title: 'Spring', tags: ['seasonal'], photoPath: null, thumbPath: null, photoBytes: 0 , imageHash: null});
  const o = await r.getOrCreateUnknownOrder();
  await r.addLine({ orderId: o.id, sheetId: w.id, quantity: 3, priceMinor: null, estimated: false });
  await r.addLine({ orderId: o.id, sheetId: s.id, quantity: 1, priceMinor: null, estimated: false });
  await r.addUsage(s.id, 1, '2026-10-19');
  return r;
}

test('shows owned sheets with copy count; used-up hidden until toggled', async () => {
  render(
    <MemoryRouter>
      <DataProvider repo={await seed()} photos={new MemoryPhotoStore()}>
        <Collection />
      </DataProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByText('Winter')).toBeTruthy();
  expect(screen.getByLabelText('3 copies')).toBeTruthy();
  expect(screen.queryByText('Spring')).toBeNull();
  fireEvent.click(screen.getByLabelText('Show used up'));
  expect(screen.getByText('Spring')).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText('Search title, artist, tag'), { target: { value: 'win' } });
  expect(screen.queryByText('Spring')).toBeNull();
});

test('search and tag dropdown sit above the list and the tag dropdown filters', async () => {
  const r = await seed();
  await r.createSheet({ artistId: null, title: 'Egg', tags: ['food'], photoPath: null, thumbPath: null, photoBytes: 0 , imageHash: null});
  const egg = (await r.loadAll()).sheets.find((s) => s.title === 'Egg')!;
  const o = await r.getOrCreateUnknownOrder();
  await r.addLine({ orderId: o.id, sheetId: egg.id, quantity: 1, priceMinor: null, estimated: false });
  const { container } = render(
    <MemoryRouter>
      <DataProvider repo={r} photos={new MemoryPhotoStore()}>
        <Collection />
      </DataProvider>
    </MemoryRouter>,
  );
  await screen.findByText('Winter');
  const search = screen.getByPlaceholderText('Search title, artist, tag');
  const tag = screen.getByLabelText('Tag');
  const list = container.querySelector('.shelf')!;
  // both controls come before the list in the page
  expect(search.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(tag.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.change(tag, { target: { value: 'food' } });
  expect(screen.getByText('Egg')).toBeTruthy();
  expect(screen.queryByText('Winter')).toBeNull();
});

test('tag dropdown is shown even before any tags exist', async () => {
  render(
    <MemoryRouter>
      <DataProvider repo={new MemoryRepo()} photos={new MemoryPhotoStore()}>
        <Collection />
      </DataProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByLabelText('Tag')).toBeTruthy();
});
