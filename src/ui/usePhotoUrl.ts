import { useEffect, useState } from 'react';
import { useData } from './DataProvider';
import type { PhotoKind } from '../data/repo';

export function usePhotoUrl(kind: PhotoKind, path: string | null): string | null {
  const { photos } = useData();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    let cancelled = false;
    photos.url(kind, path).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [kind, path, photos]);
  return url;
}