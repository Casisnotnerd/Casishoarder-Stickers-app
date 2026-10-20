import { useEffect, useState } from 'react';
import type { PhotoKind } from '../data/repo';
import { useData } from './DataProvider';

export function usePhotoUrl(kind: PhotoKind, path: string | null): string | null {
  const { photos } = useData();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (path) {
      photos.url(kind, path).then((u) => alive && setUrl(u)).catch(() => alive && setUrl(null));
    }
    return () => {
      alive = false;
    };
  }, [photos, kind, path]);
  return url;
}
