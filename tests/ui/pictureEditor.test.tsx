import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { DataProvider } from '../../src/ui/DataProvider';
import { ArtistPictureEditor } from '../../src/ui/pages/ArtistPictureEditor';
import { parseFrame } from '../../src/domain/tileFrame';

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

async function setup(withPicture: boolean) {
  const repo = new MemoryRepo();
  const photos = new MemoryPhotoStore();
  const a = await repo.createArtist('papermilio');
  if (withPicture) {
    const up = await photos.upload('thumbs', new Blob(['logo']));
    await repo.updateArtist(a.id, { avatarPath: up.path, avatarBytes: up.bytes, avatarPosition: 'frame:0.5,0.5,1' });
  }
  const o = await repo.getOrCreateUnknownOrder();
  const s = await repo.createSheet({ artistId: a.id, title: 'Winter', tags: [], photoPath: null, thumbPath: null, photoBytes: 0, imageHash: null });
  await repo.addLine({ orderId: o.id, sheetId: s.id, quantity: 1, priceMinor: null, estimated: false });
  return { repo, photos, id: a.id };
}

function editor(repo: MemoryRepo, photos: MemoryPhotoStore, id: string) {
  render(
    <DataProvider repo={repo} photos={photos}>
      <MemoryRouter initialEntries={['/', `/artist/${id}/picture`]} initialIndex={1}>
        <Routes>
          <Route path="/" element={<p>HOME</p>} />
          <Route path="/artist/:id/picture" element={<ArtistPictureEditor />} />
        </Routes>
      </MemoryRouter>
    </DataProvider>,
  );
}

test('an artist without a picture is asked to choose a photo', async () => {
  const { repo, photos, id } = await setup(false);
  editor(repo, photos, id);
  expect(await screen.findByText('Choose a photo for this tile.')).toBeTruthy();
  expect(screen.getByText('Change photo')).toBeTruthy();
  expect(screen.queryByText('Remove picture')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
});

test('with a saved picture: zoom slider then Save stores only the framing', async () => {
  const { repo, photos, id } = await setup(true);
  const upload = vi.spyOn(photos, 'upload');
  editor(repo, photos, id);
  fireEvent.change(await screen.findByLabelText('Zoom'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('HOME')).toBeTruthy();
  const a = (await repo.loadAll()).artists[0];
  expect(parseFrame(a.avatarPosition).zoom).toBe(2);
  expect(upload).not.toHaveBeenCalled();
});

test('Remove picture clears it and goes back', async () => {
  const { repo, photos, id } = await setup(true);
  editor(repo, photos, id);
  fireEvent.click(await screen.findByRole('button', { name: 'Remove picture' }));
  expect(await screen.findByText('HOME')).toBeTruthy();
  expect((await repo.loadAll()).artists[0].avatarPath).toBeNull();
});

test('Cancel goes back without saving', async () => {
  const { repo, photos, id } = await setup(true);
  editor(repo, photos, id);
  fireEvent.change(await screen.findByLabelText('Zoom'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(await screen.findByText('HOME')).toBeTruthy();
  expect((await repo.loadAll()).artists[0].avatarPosition).toBe('frame:0.5,0.5,1');
});

test('the unknown artist has no editor', async () => {
  const { repo, photos } = await setup(false);
  editor(repo, photos, 'unknown');
  expect(await screen.findByText("This artist wasn't found.")).toBeTruthy();
});
