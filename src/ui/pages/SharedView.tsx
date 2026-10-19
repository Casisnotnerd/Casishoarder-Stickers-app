import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SharedSheet } from '../../data/repo';
import { SupabasePhotoStore, SupabaseRepo } from '../../data/supabaseRepo';

export function SharedView({ token, client }: { token: string; client: SupabaseClient | null }) {
  const [items, setItems] = useState<SharedSheet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const store = useMemo(() => (client ? new SupabasePhotoStore(client) : null), [client]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!client || !store) return;
    new SupabaseRepo().sharedCollection(token)
      .then(async (rows) => {
        setItems(rows);
        const m: Record<string, string> = {};
        for (const r of rows) if (r.thumbPath) m[r.sheetId] = await store.url('thumbs', r.thumbPath);
        setUrls(m);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [client, store, token]);

  if (!client) return <main className="page"><p>Sharing works in the online version only.</p></main>;
  if (error) return <main className="page"><p className="error">{error}</p></main>;
  if (!items) return <main className="page"><p>Loading...</p></main>;
  return (
    <main className="page">
      <h1>Sticker collection</h1>
      {items.length === 0 && <p className="hint">This link is turned off or has no sheets.</p>}
      <div className="grid">
        {items.map((s) => (
          <div key={s.sheetId} className="tile">
            {urls[s.sheetId] ? <img src={urls[s.sheetId]} alt={s.title} loading="lazy" /> : <div className="noimg" />}
            <div className="meta"><div className="title">{s.title}</div><div className="hint">{s.artist ?? ''}</div></div>
          </div>
        ))}
      </div>
    </main>
  );
}