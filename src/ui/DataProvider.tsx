import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PhotoStore, Repo, Snapshot } from '../data/repo';

const EMPTY: Snapshot = { artists: [], sheets: [], orders: [], lines: [], usages: [] };

export interface DataValue extends Snapshot {
  repo: Repo;
  photos: PhotoStore;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const Ctx = createContext<DataValue | null>(null);

export function DataProvider({ repo, photos, children }: { repo: Repo; photos: PhotoStore; children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setSnap(await repo.loadAll());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return <Ctx.Provider value={{ ...snap, repo, photos, loading, error, reload }}>{children}</Ctx.Provider>;
}

export function useData(): DataValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData must be used inside DataProvider');
  return v;
}
