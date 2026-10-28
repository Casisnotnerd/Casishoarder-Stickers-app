import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowDownWideNarrow, ChevronLeft } from 'lucide-react';
import { copiesOwned } from '../../domain/holdings';
import { SORT_LABELS, sortSheets, type SortOrder } from '../../domain/journal';
import { artistFolders, sheetsInFolder } from '../../domain/folders';
import { useData } from '../DataProvider';
import { Card } from './Collection';

/** One artist's folder: every sheet by them, owned or used up. */
export function ArtistPage() {
  const { id } = useParams();
  const d = useData();
  const [order, setOrder] = useState<SortOrder>('newest');
  const [usedUp, setUsedUp] = useState(false);
  const folder = useMemo(() => artistFolders(d.artists, d.sheets, d.lines, d.usages).find((f) => f.id === id) ?? null,
    [id, d.artists, d.sheets, d.lines, d.usages]);
  const shown = useMemo(() => {
    if (!folder) return [];
    const mine = sheetsInFolder(folder, d.sheets, d.artists)
      .filter((s) => (copiesOwned(s.id, d.lines, d.usages) > 0) !== usedUp);
    return sortSheets(mine, order, d.lines, d.usages);
  }, [folder, d.sheets, d.artists, d.lines, d.usages, usedUp, order]);

  return (
    <main className="page journal">
      <Link to="/" className="back"><ChevronLeft size={18} aria-hidden /> Collection</Link>
      {!folder ? (
        <p className="empty">This artist has no sheets.</p>
      ) : (
        <>
          <header className="journal-head">
            <div>
              <h1>{folder.name}</h1>
              <p className="sub">{folder.owned} {folder.owned === 1 ? 'sheet' : 'sheets'} owned{folder.usedUp > 0 ? ` · ${folder.usedUp} used up` : ''}</p>
            </div>
          </header>
          <div className="section-head">
            <div className="segmented" role="group" aria-label="Show">
              <button className="tab" aria-pressed={!usedUp} onClick={() => setUsedUp(false)}>Owned</button>
              <button className="tab" aria-pressed={usedUp} onClick={() => setUsedUp(true)}>Used up</button>
            </div>
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
              <Card key={s.id} sheet={s} artist={folder.name} copies={copiesOwned(s.id, d.lines, d.usages)} />
            ))}
          </div>
          {shown.length === 0 && <p className="empty">{usedUp ? 'Nothing used up yet.' : 'All sheets by this artist are used up.'}</p>}
        </>
      )}
    </main>
  );
}
