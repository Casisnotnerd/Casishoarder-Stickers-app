import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Repo, PhotoStore } from '../data/repo';
import type { Snapshot } from '../data/repo';
import { MemoryRepo, MemoryPhotoStore } from '../data/memoryRepo';
import { supabase } from '../data/supabaseClient';
import { SupabaseRepo, SupabasePhotoStore } from '../data/supabaseRepo';

interface Ctx extends Snapshot {
  repo: Repo;
  photos: PhotoStore;
  reload: () => Promise<void>;
  demo: boolean;
}

const C = createContext<Ctx | null>(null);

export function useData(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error('no data provider');
  return v;
}

export function DataProvider({ children, repo, photos }: { children: ReactNode; repo?: Repo; photos?: PhotoStore }) {
  const demo = !supabase && !repo;
  const r = useMemo(() => repo ?? (supabase ? new SupabaseRepo() : new MemoryRepo()), [repo, supabase]);
  const p = useMemo(() => photos ?? (supabase ? new SupabasePhotoStore(supabase) : new MemoryPhotoStore()), [photos, supabase]);
  const [data, setData] = useState<Snapshot>({ artists: [], sheets: [], orders: [], lines: [], usages: [] });

  const reload = async () => {
    const s = await r.loadAll();
    setData(s);
  };

  useEffect(() => { void reload(); }, [r]);

  return <C.Provider value={{ repo: r, photos: p, reload, demo, ...data }}>{children}</C.Provider>;
}