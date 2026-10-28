import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BackButton } from '../../src/ui/BackButton';

function app(entries: string[], confirmLeave?: string) {
  render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route path="/artist/:id" element={<p>ARTIST PAGE</p>} />
        <Route path="/sheet/:id" element={<BackButton fallback="/" confirmLeave={confirmLeave} />} />
        <Route path="/" element={<p>HOME</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

test('goes back to the page you came from', async () => {
  app(['/artist/a', '/sheet/s']);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(await screen.findByText('ARTIST PAGE')).toBeTruthy();
});

test('with no earlier page it goes to the fallback', async () => {
  app(['/sheet/s']);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(await screen.findByText('HOME')).toBeTruthy();
});

test('confirmLeave: cancel stays, OK leaves', async () => {
  app(['/artist/a', '/sheet/s'], 'Leave without saving?');
  const spy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.queryByText('ARTIST PAGE')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(await screen.findByText('ARTIST PAGE')).toBeTruthy();
  expect(spy).toHaveBeenCalledWith('Leave without saving?');
  spy.mockRestore();
});
