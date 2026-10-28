import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownWideNarrow, Search } from 'lucide-react';
import type { Sheet } from '../../domain/types';
import { allTags, filterSheets, type SheetFilter } from '../../domain/filter';
import { copiesOwned } from '../../domain/holdings';
import { toMinor } from '../../domain/currency';
import { artistColor } from '../../domain/artistColor';
import { addedLabel, SORT_LABELS, sortSheets, type SortOrder } from '../../domain/journal';
import { useData } from '../DataProvider';
import { useScrollMemory, useSearchState } from '../SearchState';
import { usePhotoUrl } from '../usePhotoUrl';

/** Search tab: the one place to search and filter every sheet. */
export function Collection(_props: { searchMode?: boolean }) {
  const d = useData();
  const [{ filter: f, order, minS, maxS }, update] = useSearchState();
  const setF = (filter: SheetFilter) => update({ filter });
  const setOrder = (o: SortOrder) => update({ order: o });
  const setMinS = (v: string) => update({ minS: v });
  const setMaxS = (v: string) => update({ maxS: v });
  useScrollMemory('search');
  const filtered = useMemo(() => filterSheets(f, d), [f, d]);
  const shown = useMemo(() => sortSheets(filtered, order, d.lines, d.usages), [filtered, order, d.lines, d.usages]);
  const tags = useMemo(() => allTags(d.sheets), [d.sheets]);
  const artistName = useMemo(() => new Map(d.artists.map((a) => [a.id, a.name])), [d.artists]);
  const artists = useMemo(() => {
    const seen = new Set<string>();
    return [...d.artists]
      .filter((a) => { const n = a.name.trim().toLowerCase(); if (seen.has(n)) return false; seen.add(n); return true; })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [d.artists]);

  return (
    <main className="page journal">
      <header className="journal-head">
        <div>
          <h1>Find a little favourite.</h1>
          <p className="sub">Search all {d.sheets.length} sheets in your collection.</p>
        </div>
      </header>

      <label className="searchbox">
        <Search size={18} aria-hidden="true" />
        <input type="search" aria-label="Search" placeholder="Find a sticker, artist or tag" value={f.text}
          autoFocus={!f.text}
          onChange={(e) => setF({ ...f, text: e.target.value })} />
      </label>

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

      <div className="filters">
        <select aria-label="Artist" className="tagselect" value={f.artistId ?? ''}
          onChange={(e) => setF({ ...f, artistId: e.target.value || null })}>
          <option value="">All artists</option>
          {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button className="tab" aria-pressed={!f.showUsedUp} onClick={() => setF({ ...f, showUsedUp: false })}>Latest</button>
        <button className="tab" aria-pressed={f.showUsedUp} onClick={() => setF({ ...f, showUsedUp: true })}>Used up</button>
      </div>

      <div className="section-head">
        <h2>{shown.length} little {shown.length === 1 ? 'find' : 'finds'}</h2>
        <label className="sort">
          <span className="visually-hidden">Sort</span>
          <select aria-label="Sort" value={order} onChange={(e) => setOrder(e.target.value as SortOrder)}>
            {(Object.keys(SORT_LABELS) as SortOrder[]).map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
          </select>
          <ArrowDownWideNarrow size={15} aria-hidden="true" />
        </label>
      </div>

      <div className="shelf">
        {shown.map((s) => (
          <Card key={s.id} sheet={s} artist={s.artistId ? artistName.get(s.artistId) ?? '' : ''}
            copies={copiesOwned(s.id, d.lines, d.usages)}
            avatarPath={d.artists.find((a) => a.id === s.artistId)?.avatarPath ?? null} />
        ))}
      </div>
      {d.sheets.length === 0 && <p className="empty">Nothing to search yet. Tap + to add your first sheets.</p>}
      {d.sheets.length > 0 && shown.length === 0 && <p className="empty">No sheets match.</p>}

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

export function Card({ sheet, artist, copies, avatarPath }: { sheet: Sheet; artist: string; copies: number; avatarPath?: string | null }) {
  const avatarUrl = usePhotoUrl('thumbs', avatarPath ?? null);
  const thumbUrl = usePhotoUrl('thumbs', sheet.thumbPath);
  const [imgFailed, setImgFailed] = useState(false);
  const url = (!imgFailed && avatarUrl) ? avatarUrl : (thumbUrl ?? null);
  const c = artistColor(sheet.artistId);
  const label = copies > 0 ? `${copies} ${copies === 1 ? 'copy' : 'copies'}` : 'Used up';
  const added = addedLabel(sheet.createdAt);
  return (
    <Link className={`sticker${copies > 0 ? '' : ' usedup'}`} to={`/sheet/${sheet.id}`} style={{ '--tab': c.tab } as CSSProperties}>
      <div className="mount">
        {url ? <img src={url} alt="" loading="lazy" onError={() => setImgFailed(true)} /> : null}
        {added && <span className="badge">{added}</span>}
        <span className="copies" aria-label={label}>{copies > 0 ? `×${copies}` : 'Used up'}</span>
      </div>
      <div className="title">{sheet.title}</div>
      <div className="artist">{artist || 'Unknown artist'}</div>
    </Link>
  );
}
