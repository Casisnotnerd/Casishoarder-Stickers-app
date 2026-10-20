import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { DataProvider } from '../../src/ui/DataProvider';
import { Settings } from '../../src/ui/pages/Settings';

test('share link toggles on and shows a link; artists can be merged', async () => {
  const repo = new MemoryRepo();
  await repo.createArtist('JUIMJUIM');
  await repo.createArtist('Juimsuim');
  await repo.createSheet({ artistId: null, title: 'Big', tags: [], photoPath: null, thumbPath: null, photoBytes: 900_000_000 , imageHash: null});
  render(
    <MemoryRouter>
      <DataProvider repo={repo} photos={new MemoryPhotoStore()}><Settings /></DataProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByText(/Storage almost full/)).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Share my collection'));
  expect(await screen.findByText(/#\/s\/[0-9a-f]{32}/)).toBeTruthy();

  fireEvent.change(screen.getByLabelText('Keep'), { target: { value: 'artist-1' } });
  fireEvent.change(screen.getByLabelText('Merge into it'), { target: { value: 'artist-2' } });
  fireEvent.click(screen.getByText('Merge artists'));
  await screen.findByText(/Merged/);
  const s = await repo.loadAll();
  expect(s.artists).toEqual([{ id: 'artist-1', name: 'JUIMJUIM', aliases: ['Juimsuim'] }]);
});
