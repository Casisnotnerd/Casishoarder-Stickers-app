import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { Sheet } from '../../domain/types';
import { EMPTY_FILTER, allTags, filterSheets, type SheetFilter } from '../../domain/filter';
import { copiesOwned } from '../../domain/holdings';
import { toMinor } from '../../domain/currency';
import { artistColor } from '../../domain/artistColor';
import { useData } from '../DataProvider';
import { usePhotoUrl } from '../usePhotoUrl';

export function Collection() {
  const d = useData();
  const [f, setF] = useState<SheetFilter>(EMPTY_FILTER);
  const [minS, setMinS] = useState('');
  const [maxS, setMaxS] = useState('');
  const shown = useMemo(() => filterSheets(f, d), [f, d]);
  const tags = useMemo(() => allTags(d.sheets), [d.sheets]);
  const artistName = useMemo(() => new Map(d.artists.map((a) => [a.id, a.name])), [d.artists]);
  const artists = useMemo(() => {
    const seen = new Set<string>();
    return [...d.artists]
      .filter((a) => { const n = a.name.trim().toLowerCase(); if (seen.has(n)) return false; seen.add(n); return true; })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [d.artists]);
  const totalCopies = useMemo(
    () => d.sheets.reduce((n, s) => n + Math.max(0, copiesOwned(s.id, d.lines, d.usages)), 0),
    [d.sheets, d.lines, d.usages],
  );

  return (
    <main className="page">
      <h1>Collection</h1>
      <p className="sub">{d.sheets.length} sheets · {totalCopies} copies · {d.artists.length} artists</p>

      <input className="search" type="search" placeholder="Search title, artist, tag" value={f.text}
        onChange={(e) => setF({ ...f, text: e.target.value })} />

      <div className="filters">
        <select aria-label="Tag" className="tagselect" value={f.tag ?? ''}
          onChange={(e) => setF({ ...f, tag: e.target.value || null })}>
          <option value="">{tags.length ? 'All tags' : 'No tags yet'}</option>
          {tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label>
          <input type="checkbox" checked={f.showUsedUp} onChange={(e) => setF({ ...f, showUsedUp: e.target.checked })} />
          Show used up
        </label>
      </div>

      <div className="row" style={{ marginBottom: 8 }}>
        <select aria-label="Artist" value={f.artistId ?? ''} onChange={(e) => setF({ ...f, artistId: e.target.value || null })}>
          <option value="">All artists</option>
          {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button className="tab" aria-pressed={!f.showUsedUp} onClick={() => setF({ ...f, showUsedUp: false })}>Latest</button>
        <button className="tab" aria-pressed={f.showUsedUp} onClick={() => setF({ ...f, showUsedUp: true })}>Used up</button>
      </div>

      <div className="shelf">
        {shown.map((s) => (
          <Entry key={s.id} sheet={s} artist={s.artistId ? artistName.get(s.artistId) ?? '' : ''}
            copies={copiesOwned(s.id, d.lines, d.usages)} />
        ))}
        {d.sheets.length === 0 && <p className="empty">Your shelf is empty. Tap Add to log your first sheet.</p>}
        {d.sheets.length > 0 && shown.length === 0 && <p className="empty">No sheets match.</p>}
      </div>

      <details className="more">
        <summary>Filter by date or price</summary>
        <div className="row">
          <label>Bought from<input type="date" value={f.dateFrom ?? ''} onChange={(e) => setF({ ...f, dateFrom: e.target.value || null })} /></label>
          <label>to<input type="date" value={f.dateTo ?? ''} onChange={(e) => setF({ ...f, dateTo: e.target.value || null })} /></label>
        </div>
        <div className="row">
          <label>Min S$ each<input inputMode="decimal" value={minS} onChange={(e) => { setMinS(e.target.value); setF({ ...f, minSgdMinor: toMinor(e.target.value, 'SGD') }); }} /></label>
          <label>Max S$ each<input inputMode="decimal" value={maxS} onChange={(e) => { setMaxS(e.target.value); setF({ ...f, maxSgdMinor: toMinor(e.target.value, 'SGD') }); }} /></label>
        </div>
      </details>
    </main>
  );
}

function Entry({ sheet, artist, copies }: { sheet: Sheet; artist: string; copies: number }) {
  const url = usePhotoUrl('thumbs', sheet.thumbPath);
  const c = artistColor(sheet.artistId);
  const label = copies > 0 ? `${copies} ${copies === 1 ? 'copy' : 'copies'}` : 'Used up';
  return (
    <Link className={`entry${copies > 0 ? '' : ' usedup'}`} to={`/sheet/${sheet.id}`} style={{ '--tab': c.tab } as CSSProperties}>
      {url ? <img className="thumb" src={url} alt="" loading="lazy" /> : <div className="thumb" />}
      <span className="sr-only">{sheet.title}</span>
      <div className="who">
        <div className="artist">{artist || 'Unknown artist'}</div>
      </div>
      <div className="count" aria-label={label}>{copies > 0 ? copies : 'Used up'}</div>
    </Link>
  );
}
