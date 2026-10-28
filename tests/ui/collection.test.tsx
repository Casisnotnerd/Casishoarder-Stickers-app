import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { DataProvider } from '../../src/ui/DataProvider';
import { Collection } from '../../src/ui/pages/Collection';
import { SearchStateProvider } from '../../src/ui/SearchState';
import { Home } from '../../src/ui/pages/Home';
import { ArtistPage } from '../../src/ui/pages/ArtistPage';

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
        <SearchStateProvider><Collection /></SearchStateProvider>
      </DataProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByText('Winter')).toBeTruthy();
  expect(screen.getByLabelText('3 copies')).toBeTruthy();
  expect(screen.queryByText('Spring')).toBeNull();
  fireEvent.click(screen.getByLabelText('Show used up'));
  expect(screen.getByText('Spring')).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText('Find a sticker, artist or tag'), { target: { value: 'win' } });
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
        <SearchStateProvider><Collection /></SearchStateProvider>
      </DataProvider>
    </MemoryRouter>,
  );
  await screen.findByText('Winter');
  const search = screen.getByPlaceholderText('Find a sticker, artist or tag');
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
        <SearchStateProvider><Collection /></SearchStateProvider>
      </DataProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByLabelText('Tag')).toBeTruthy();
});

test('Collection home shows the 10 newest, then artist folders A to Z', async () => {
  const r = new MemoryRepo();
  const o = await r.getOrCreateUnknownOrder();
  const p = await r.createArtist('papermilio');
  const m = await r.createArtist('Mumu');
  for (let i = 1; i <= 13; i++) {
    const s = await r.createSheet({ artistId: i % 2 ? p.id : m.id, title: `Sheet ${i}`, tags: [], photoPath: null, thumbPath: null, photoBytes: 0, imageHash: null });
    await r.addLine({ orderId: o.id, sheetId: s.id, quantity: 1, priceMinor: null, estimated: false });
  }
  render(
    <MemoryRouter>
      <DataProvider repo={r} photos={new MemoryPhotoStore()}>
        <Home />
      </DataProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByText('Sheet 13')).toBeTruthy();
  expect(screen.getByText('Sheet 4')).toBeTruthy();
  expect(screen.queryByText('Sheet 3')).toBeNull();
  expect(screen.queryByPlaceholderText('Find a sticker, artist or tag')).toBeNull(); // searching lives on Search
  const names = [...document.querySelectorAll('.folder-name')].map((n) => n.textContent);
  expect(names).toEqual(['Mumu', 'papermilio']);
  expect(screen.getByText('7 sheets')).toBeTruthy();
});

test('an artist folder lists only that artist, with an Owned / Used up switch', async () => {
  const r = new MemoryRepo();
  const o = await r.getOrCreateUnknownOrder();
  const p = await r.createArtist('papermilio');
  const add = async (title: string, artistId: string | null) => {
    const s = await r.createSheet({ artistId, title, tags: [], photoPath: null, thumbPath: null, photoBytes: 0, imageHash: null });
    await r.addLine({ orderId: o.id, sheetId: s.id, quantity: 1, priceMinor: null, estimated: false });
    return s;
  };
  await add('Winter', p.id);
  const sp = await add('Spring', p.id);
  await add('Egg', null);
  await r.addUsage(sp.id, 1, '2026-10-01');
  render(
    <MemoryRouter initialEntries={[`/artist/${p.id}`]}>
      <DataProvider repo={r} photos={new MemoryPhotoStore()}>
        <Routes><Route path="/artist/:id" element={<ArtistPage />} /></Routes>
      </DataProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByText('Winter')).toBeTruthy();
  expect(screen.queryByText('Spring')).toBeNull();
  expect(screen.queryByText('Egg')).toBeNull();
  fireEvent.click(screen.getByText('Used up'));
  expect(screen.getByText('Spring')).toBeTruthy();
  expect(screen.queryByText('Winter')).toBeNull();
  expect(screen.getByText('Collection')).toBeTruthy(); // back link
});

test('search is never limited to 10', async () => {
  const r = new MemoryRepo();
  const o = await r.getOrCreateUnknownOrder();
  for (let i = 1; i <= 12; i++) {
    const s = await r.createSheet({ artistId: null, title: `Bear ${i}`, tags: [], photoPath: null, thumbPath: null, photoBytes: 0, imageHash: null });
    await r.addLine({ orderId: o.id, sheetId: s.id, quantity: 1, priceMinor: null, estimated: false });
  }
  render(
    <MemoryRouter>
      <DataProvider repo={r} photos={new MemoryPhotoStore()}>
        <SearchStateProvider><Collection /></SearchStateProvider>
      </DataProvider>
    </MemoryRouter>,
  );
  await screen.findByText('Bear 12');
  fireEvent.change(screen.getByPlaceholderText('Find a sticker, artist or tag'), { target: { value: 'bear' } });
  expect(screen.getByText('Bear 1')).toBeTruthy();
  expect(screen.getByText('12 little finds')).toBeTruthy();
});

async function folderRepo(withPicture: boolean) {
  const r = new MemoryRepo();
  const photos = new MemoryPhotoStore();
  const o = await r.getOrCreateUnknownOrder();
  const p = await r.createArtist('papermilio');
  if (withPicture) {
    const up = await photos.upload('thumbs', new Blob(['logo']));
    await r.updateArtist(p.id, { avatarPath: up.path, avatarBytes: up.bytes });
  }
  for (const [title, artistId] of [['Winter', p.id], ['Egg', null]] as const) {
    const s = await r.createSheet({ artistId, title, tags: [], photoPath: null, thumbPath: null, photoBytes: 0, imageHash: null });
    await r.addLine({ orderId: o.id, sheetId: s.id, quantity: 1, priceMinor: null, estimated: false });
  }
  return { r, photos, p };
}

function artistRoute(r: MemoryRepo, photos: MemoryPhotoStore, path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <DataProvider repo={r} photos={photos}>
        <Routes><Route path="/artist/:id" element={<ArtistPage />} /></Routes>
      </DataProvider>
    </MemoryRouter>,
  );
}

test('artist page offers Change picture; Remove picture only once one is set', async () => {
  URL.createObjectURL = vi.fn(() => 'blob:x');
  const plain = await folderRepo(false);
  artistRoute(plain.r, plain.photos, `/artist/${plain.p.id}`);
  expect(await screen.findByText('Change picture')).toBeTruthy();
  expect(screen.queryByText('Remove picture')).toBeNull();
  cleanup();
  const pic = await folderRepo(true);
  artistRoute(pic.r, pic.photos, `/artist/${pic.p.id}`);
  expect(await screen.findByText('Remove picture')).toBeTruthy();
});

test('the Unknown artist folder has no picture controls', async () => {
  const { r, photos } = await folderRepo(false);
  artistRoute(r, photos, '/artist/unknown');
  expect(await screen.findByText('Egg')).toBeTruthy();
  expect(screen.queryByText('Change picture')).toBeNull();
});

test('a folder with a picture fills the tile', async () => {
  URL.createObjectURL = vi.fn(() => 'blob:x');
  const { r, photos } = await folderRepo(true);
  render(
    <MemoryRouter>
      <DataProvider repo={r} photos={photos}><Home /></DataProvider>
    </MemoryRouter>,
  );
  await screen.findAllByText('papermilio');
  await waitFor(() => expect(document.querySelector('.folder-cover.has-picture img')).not.toBeNull());
});

test('the picture file chooser is hidden behind the Change picture button', async () => {
  const { r, photos, p } = await folderRepo(false);
  artistRoute(r, photos, `/artist/${p.id}`);
  const input = (await screen.findByText('Change picture')).querySelector('input[type=file]') as HTMLInputElement;
  expect(input.style.display).toBe('none');
});
