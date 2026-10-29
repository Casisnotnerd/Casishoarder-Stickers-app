import { useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Pencil, Sparkles } from 'lucide-react';
import { copiesOwned } from '../../domain/holdings';
import { artistColor } from '../../domain/artistColor';
import { addedThisMonth, sortSheets } from '../../domain/journal';
import { artistFolders, UNKNOWN_FOLDER, type ArtistFolder } from '../../domain/folders';
import { useData } from '../DataProvider';
import { usePhotoUrl } from '../usePhotoUrl';
import { Card } from './Collection';
import { FramedPicture } from '../FramedPicture';

export const LATEST_LIMIT = 10;

/** Collection tab: calm browsing. Latest additions, then one folder per artist. Searching lives on the Search tab. */
export function Home() {
  const d = useData();
  const artistName = useMemo(() => new Map(d.artists.map((a) => [a.id, a.name])), [d.artists]);
  const latest = useMemo(
    () => sortSheets(d.sheets.filter((s) => copiesOwned(s.id, d.lines, d.usages) > 0), 'newest', d.lines, d.usages).slice(0, LATEST_LIMIT),
    [d.sheets, d.lines, d.usages],
  );
  const folders = useMemo(() => artistFolders(d.artists, d.sheets, d.lines, d.usages), [d.artists, d.sheets, d.lines, d.usages]);
  const thisMonth = useMemo(() => addedThisMonth(d.sheets), [d.sheets]);

  return (
    <main className="page journal">
      <header className="journal-head">
        <div>
          <p className="brand">Sticker Vault</p>
          <h1>Your sticker story.</h1>
        </div>
        <Link to="/settings" className="avatar" aria-label="Settings">C</Link>
      </header>

      {d.sheets.length === 0 ? (
        <section className="welcome">
          <h2>Start your vault</h2>
          <p>Take a photo of one sheet, or lay out several and add them together.</p>
          <Link to="/add" className="button-link">Add your first sheets</Link>
        </section>
      ) : (
        <>
          <section className="summary">
            <div>
              <p className="summary-count">{d.sheets.length} little {d.sheets.length === 1 ? 'joy' : 'joys'}</p>
              <p className="summary-month">+{thisMonth} {thisMonth === 1 ? 'sheet' : 'sheets'} tucked away this month</p>
            </div>
            <div className="note" aria-hidden="true">
              <Sparkles size={25} strokeWidth={1.5} />
              <span>keep happy</span>
            </div>
          </section>

          {latest.length > 0 && (
            <>
              <div className="section-head">
                <h2>Latest additions</h2>
                <Link to="/search" className="see-link">See all <ChevronRight size={15} aria-hidden /></Link>
              </div>
              <div className="latest-row" aria-label="Latest additions">
                {latest.map((s) => (
                  <Card key={s.id} sheet={s} artist={s.artistId ? artistName.get(s.artistId) ?? '' : ''}
                    copies={copiesOwned(s.id, d.lines, d.usages)} />
                ))}
              </div>
            </>
          )}

          <div className="section-head">
            <h2>Artists</h2>
            <span className="hint">{folders.filter((f) => f.id !== UNKNOWN_FOLDER).length} · A to Z</span>
          </div>
          <div className="folders">
            {folders.map((f) => <Folder key={f.id} folder={f} />)}
          </div>
        </>
      )}
    </main>
  );
}

function Folder({ folder }: { folder: ArtistFolder }) {
  const avatar = usePhotoUrl('thumbs', folder.avatarPath);
  const cover = usePhotoUrl('thumbs', folder.cover?.thumbPath ?? null);
  const unknown = folder.id === UNKNOWN_FOLDER;
  const c = artistColor(unknown ? null : folder.id);
  return (
    <div className="folder" style={{ '--tab': c.tab } as CSSProperties}>
      <Link to={`/artist/${folder.id}`} className="folder-link">
        <div className={`folder-cover${avatar ? ' has-picture' : ''}`}>
          {avatar
            ? <FramedPicture src={avatar} frame={folder.avatarPosition} />
            : cover ? <img src={cover} alt="" loading="lazy" /> : null}
        </div>
        <div className="folder-name">{folder.name}</div>
        <div className="folder-count">
          {folder.owned} {folder.owned === 1 ? 'sheet' : 'sheets'}{folder.usedUp > 0 ? ` · ${folder.usedUp} used up` : ''}
        </div>
      </Link>
      {!unknown && (
        <Link to={`/artist/${folder.id}/picture`} className="tile-edit" aria-label={`Change picture for ${folder.name}`}>
          <Pencil size={16} aria-hidden />
        </Link>
      )}
    </div>
  );
}
