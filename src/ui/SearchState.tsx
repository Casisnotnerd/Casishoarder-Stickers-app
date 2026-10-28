import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { EMPTY_FILTER, type SheetFilter } from '../domain/filter';
import type { SortOrder } from '../domain/journal';

/** What you typed and picked on the Search tab, kept while you open a sheet and come Back. */
export interface SearchState {
  filter: SheetFilter;
  order: SortOrder;
  minS: string;
  maxS: string;
}

const INITIAL: SearchState = { filter: EMPTY_FILTER, order: 'newest', minS: '', maxS: '' };
const Ctx = createContext<[SearchState, (patch: Partial<SearchState>) => void] | null>(null);

export function SearchStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SearchState>(INITIAL);
  const update = useCallback((patch: Partial<SearchState>) => setState((s) => ({ ...s, ...patch })), []);
  return <Ctx.Provider value={[state, update]}>{children}</Ctx.Provider>;
}

export function useSearchState(): [SearchState, (patch: Partial<SearchState>) => void] {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSearchState must be used inside SearchStateProvider');
  return v;
}

const scrolls = new Map<string, number>();

/** Remembers how far down a page you were, and returns there when you come back to it. */
export function useScrollMemory(key: string): void {
  useEffect(() => {
    const y = scrolls.get(key);
    let frame = 0;
    if (y !== undefined) frame = requestAnimationFrame(() => window.scrollTo(0, y));
    return () => {
      cancelAnimationFrame(frame);
      scrolls.set(key, window.scrollY);
    };
  }, [key]);
}

/** A newly opened page starts at the top (so its Back button is visible); Back keeps the remembered position. */
export function ScrollToTopOnNewPage(): null {
  const { pathname } = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    if (type !== 'POP') window.scrollTo(0, 0);
  }, [pathname, type]);
  return null;
}
