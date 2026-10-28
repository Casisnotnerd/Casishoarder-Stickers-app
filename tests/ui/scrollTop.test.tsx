import { act, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { ScrollToTopOnNewPage } from '../../src/ui/SearchState';

function Back() {
  const nav = useNavigate();
  return <button onClick={() => nav(-1)}>Back</button>;
}

test('opening a new page starts at the top; going Back does not', async () => {
  const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(
    <MemoryRouter>
      <ScrollToTopOnNewPage />
      <Routes>
        <Route path="/" element={<Link to="/sheet/1">open</Link>} />
        <Route path="/sheet/:id" element={<Back />} />
      </Routes>
    </MemoryRouter>,
  );
  spy.mockClear();
  await act(async () => { fireEvent.click(screen.getByText('open')); });
  expect(spy).toHaveBeenCalledWith(0, 0);
  spy.mockClear();
  await act(async () => { fireEvent.click(screen.getByText('Back')); });
  expect(spy).not.toHaveBeenCalledWith(0, 0);
  spy.mockRestore();
});
