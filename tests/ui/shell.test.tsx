import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MemoryPhotoStore, MemoryRepo } from '../../src/data/memoryRepo';
import { DataProvider } from '../../src/ui/DataProvider';
import { Shell } from '../../src/ui/Shell';

test('demo shell shows banner and bottom tabs', async () => {
  render(
    <MemoryRouter>
      <DataProvider repo={new MemoryRepo()} photos={new MemoryPhotoStore()}>
        <Shell demo />
      </DataProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByText(/Demo mode/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Spending' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Add' })).toBeTruthy();
});

test('Search tab opens the collection with the search box focused', async () => {
  render(
    <MemoryRouter initialEntries={['/search']}>
      <DataProvider repo={new MemoryRepo()} photos={new MemoryPhotoStore()}>
        <Shell demo />
      </DataProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByRole('heading', { name: 'Find a little favourite.' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Search' })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByPlaceholderText('Find a sticker, artist or tag'));
});
