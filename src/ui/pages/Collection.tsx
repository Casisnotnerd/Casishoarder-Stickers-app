import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EMPTY_FILTER, filterSheets, allTags } from '../../domain/filter';
import { copiesOwned } from '../../domain/holdings';
import { useData } from '../DataProvider';
import { usePhotoUrl } from '../usePhotoUrl';
import { toMinor } from '../../domain/currency';

export function Collection() {
  const d = useData();
  const [f, setF] = useState(EMPTY_FILTER);
  const [minS, setMinS] = useState('');
  const [maxS, setMaxS] = useState('');
  const shown = filterSheets(f, d);
  const artistName = new Map(d.artists.map((a) => [a.id, a.name]));

  return (
    <main className="page">
      <h1>Collection</h1>
      <input placeholder="Search title, artist, tag..." value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
      <div className="row">
        <select value={f.tag ?? ''} onChange={(e) => setF({ ...f, tag: e.target.value || null })}>
          <option value="">All tags</option>
          {allTags(d.sheets).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={f.showUsedUp} onChange={(e) => setF({ ...f, showUsedUp: e.target.checked })} />
          Show used up
        </label>
      </div>
      <details>
        <summary className="hint">More filters (date, price)</summary>
        <div className="row">
          <label>Bought from<input type="date" value={f.dateFrom ?? ''} onChange={(e) => setF({ ...f, dateFrom: e.target.value || null })} /></label>
          <label>to<input type="date" value={f.dateTo ?? ''} onChange={(e) => setF({ ...f, dateTo: e.target.value || null })} /></label>
        </div>
        <div className="row">
          <label>Min S$ each<input inputMode="decimal" value={minS} onChange={(e) => { setMinS(e.target.value); setF({ ...f, minSgdMinor: toMinor(e.target.value, 'SGD') }); }} /></label>
          <label>Max S$ each<input inputMode="decimal" value={maxS} onChange={(e) => { setMaxS(e.target.value); setF({ ...f, maxSgdMinor: toMinor(e.target.value, 'SGD') }); }} /></label>
        </div>
      </details>
      {d.sheets.length === 0 && <p className="hint">No sheets yet. Tap Add to log your first one.</p>}
      <div className="grid">
        {shown.map((s) => (
          <Tile key={s.id} sheet={s} artist={s.artistId ? artistName.get(s.artistId) ?? '' : ''}
            copies={copiesOwned(s.id, d.lines, d.usages)} />
        ))}
      </div>
    </main>
  );
}

function Tile({ sheet, artist, copies }: { sheet: any; artist: string; copies: number }) {
  const url = usePhotoUrl('thumbs', sheet.thumbPath);
  return (
    <Link className="tile" to={`/sheet/${sheet.id}`}>
      {url ? <img src={url} alt={sheet.title} loading="lazy" /> : <div className="noimg" />}
      <div className="meta">
        <span className="count">{copies > 0 ? copies : 'used up'}</span>
        <div className="title">{sheet.title}</div>
        <div className="hint">{artist}</div>
      </div>
    </Link>
  );
}