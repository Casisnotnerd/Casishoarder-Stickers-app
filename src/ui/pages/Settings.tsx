import { useEffect, useState } from 'react';
import type { ShareLink } from '../../domain/types';
import { collectionCsv } from '../../domain/csv';
import { normalizeText } from '../../domain/text';
import { useData } from '../DataProvider';
import { usePhotoUrl } from '../usePhotoUrl';
import { downloadText } from '../download';
import { setArtistPicture } from '../artistPicture';

const FREE_STORAGE_BYTES = 1024 ** 3; // Supabase free plan: 1 GB file storage

export function Settings({ onSignOut }: { onSignOut?: () => void }) {
  const d = useData();
  const [share, setShare] = useState<ShareLink | null>(null);
  const [keep, setKeep] = useState('');
  const [merge, setMerge] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { void d.repo.getShareLink().then(setShare); }, [d.repo]);

  // Auto-merge artists with identical normalized names.
  useEffect(() => {
    (async () => {
      const seen = new Map<string, string>();
      for (const a of d.artists) {
        const n = normalizeText(a.name);
        if (seen.has(n)) {
          try { await d.repo.mergeArtists(seen.get(n)!, a.id); } catch { /* ignore */ }
        } else {
          seen.set(n, a.id);
        }
      }
      await d.reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const used = d.sheets.reduce((n, s) => n + s.photoBytes, 0);
  const pct = (used / FREE_STORAGE_BYTES) * 100;
  const link = share ? `${location.origin}${location.pathname}#/s/${share.token}` : '';

  const doMerge = async () => {
    setMsg(null);
    try {
      await d.repo.mergeArtists(keep, merge);
      await d.reload();
      setMerge('');
      setMsg('Merged. The old name is kept as an alias.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <main className="page">
      <h1>Settings</h1>

      <h2>Share link</h2>
      <div className="card">
        <label>
          <input type="checkbox" checked={share?.enabled ?? false}
            onChange={async (e) => setShare(await d.repo.setShareLinkEnabled(e.target.checked))} />
          Share my collection
        </label>
        <p className="hint">Shows photos, titles and artists only. Prices, orders and shops are never shared.</p>
        {share?.enabled && (
          <>
            <p style={{ wordBreak: 'break-all' }}>{link}</p>
            <button onClick={() => void navigator.clipboard?.writeText(link)}>Copy link</button>
          </>
        )}
      </div>

      <h2>Artists</h2>
      <div className="card">
        <p className="hint">Tap an artist to set their avatar photo.</p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {d.artists.map((a) => (
            <label key={a.id} style={{ textAlign: 'center', width: 80 }}>
              <Avatar id={a.id} path={a.avatarPath} />
              <div className="hint" style={{ fontSize: '0.75rem' }}>{a.name}</div>
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    await setArtistPicture({ repo: d.repo, photos: d.photos, artistIds: [a.id], oldPaths: a.avatarPath ? [a.avatarPath] : [], file });
                    await d.reload();
                  } catch {
                    setMsg("Couldn't save the picture. Try again.");
                  }
                }} />
            </label>
          ))}
        </div>
      </div>
      <div className="card">
        <p className="hint">Same artist under two names? Merge them.</p>
        <div className="row">
          <label>Keep
            <select value={keep} onChange={(e) => setKeep(e.target.value)} aria-label="Keep">
              <option value="">Choose...</option>
              {d.artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label>Merge into it
            <select value={merge} onChange={(e) => setMerge(e.target.value)} aria-label="Merge into it">
              <option value="">Choose...</option>
              {d.artists.filter((a) => a.id !== keep).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        </div>
        <button disabled={!keep || !merge} onClick={() => void doMerge()}>Merge artists</button>
        {msg && <p className="hint">{msg}</p>}
      </div>

      <h2>Storage</h2>
      <div className="card">
        <p>{(used / 1024 ** 2).toFixed(0)} MB of 1024 MB used ({pct.toFixed(0)}%)</p>
        {pct >= 80 && <p className="warn">Storage almost full. Ask Claude to add Cloudflare R2 storage.</p>}
      </div>

      <h2>Data</h2>
      <button onClick={() => downloadText('sticker-collection.csv', collectionCsv(d))}>Export CSV</button>
      {onSignOut && <button onClick={onSignOut}>Sign out</button>}
      <p className="hint">Home currency: SGD.</p>
    </main>
  );
}

function Avatar({ path }: { id: string; path: string | null }) {
  const url = usePhotoUrl('thumbs', path);
  return url ? <img src={url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#eee', margin: '0 auto' }} />;
}
