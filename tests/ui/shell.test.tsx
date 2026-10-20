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
