import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CropBox } from '../CropBox';
import { cropToJpeg, loadImage } from '../../image/crop';
import { fullRect, type Rect } from '../../image/geometry';
import { ArrowDownWideNarrow, ChevronLeft } from 'lucide-react';
import { copiesOwned } from '../../domain/holdings';
import { SORT_LABELS, sortSheets, type SortOrder } from '../../domain/journal';
import { artistFolders, sheetsInFolder, UNKNOWN_FOLDER } from '../../domain/folders';
import { useData } from '../DataProvider';
import { useScrollMemory } from '../SearchState';
import { usePhotoUrl } from '../usePhotoUrl';
import { removeArtistPicture, setArtistPicture } from '../artistPicture';
import { Card } from './Collection';

/** One artist's folder: every sheet by them, owned or used up. */
export function ArtistPage() {
  const { id } = useParams();
  const d = useData();
  const [order, setOrder] = useState<SortOrder>('newest');
  const [usedUp, setUsedUp] = useState(false);
  const [picBusy, setPicBusy] = useState<string | null>(null);
  const [picError, setPicError] = useState(false);
  const [cropImg, setCropImg] = useState<ImageBitmap | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState<Rect | null>(null);
  useScrollMemory(`artist:${id}`);
  useEffect(() => () => { if (cropSrc) URL.revokeObjectURL(cropSrc); }, [cropSrc]);
  const folder = useMemo(() => artistFolders(d.artists, d.sheets, d.lines, d.usages).find((f) => f.id === id) ?? null,
    [id, d.artists, d.sheets, d.lines, d.usages]);
  useEffect(() => {
    const pos = d.artists.find((a) => folder?.artistIds.includes(a.id))?.avatarPosition;
    if (pos) {
      const m = pos.match(/(\d+)%\s+(\d+)%/);
      if (m) setPosY(Number(m[2]));
    }
  }, [folder?.artistIds, d.artists]);
  const shown = useMemo(() => {
    if (!folder) return [];
    const mine = sheetsInFolder(folder, d.sheets, d.artists)
      .filter((s) => (copiesOwned(s.id, d.lines, d.usages) > 0) !== usedUp);
    return sortSheets(mine, order, d.lines, d.usages);
  }, [folder, d.sheets, d.artists, d.lines, d.usages, usedUp, order]);

  const avatarUrl = usePhotoUrl('thumbs', folder?.avatarPath ?? null);
  const coverUrl = usePhotoUrl('thumbs', folder?.cover?.thumbPath ?? null);
  const canPicture = !!folder && folder.id !== UNKNOWN_FOLDER;
  const oldPaths = folder
    ? [...new Set(d.artists.filter((a) => folder.artistIds.includes(a.id)).map((a) => a.avatarPath).filter((p): p is string => !!p))]
    : [];

  const [picErrorMsg, setPicErrorMsg] = useState('');
  const [posY, setPosY] = useState(50);
  const pickPicture = async (file: File | null) => {
    if (!file) return;
    const bmp = await loadImage(file);
    setCropImg(bmp);
    setCropSrc(URL.createObjectURL(file));
    setCropRect(fullRect(bmp.width, bmp.height));
  };
  const rotateCrop = async (dir: 1 | -1) => {
    if (!cropImg) return;
    const canvas = document.createElement('canvas');
    canvas.width = cropImg.height;
    canvas.height = cropImg.width;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(dir * Math.PI / 2);
    ctx.drawImage(cropImg, -cropImg.width / 2, -cropImg.height / 2);
    const newBmp = await createImageBitmap(canvas);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.92));
    setCropImg(newBmp);
    setCropSrc(URL.createObjectURL(blob));
    setCropRect(fullRect(newBmp.width, newBmp.height));
  };
  const savePicture = async () => {
    if (!folder || !cropImg || !cropRect) return;
    setPicError(false);
    setPicErrorMsg('');
    setPicBusy('Saving picture…');
    try {
      const cropped = await cropToJpeg(cropImg, cropRect, 400, 0.85);
      await setArtistPicture({ repo: d.repo, photos: d.photos, artistIds: folder.artistIds, oldPaths, file: cropped });
      await d.reload();
      setCropImg(null);
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
      setCropRect(null);
    } catch (e) {
      setPicError(true);
      setPicErrorMsg(e instanceof Error ? e.message : String(e));
      console.error('artist picture error:', e);
    } finally {
      setPicBusy(null);
    }
  };
  const cancelPicture = () => {
    setCropImg(null);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropRect(null);
  };
  const removePicture = async () => {
    if (!folder) return;
    setPicError(false);
    setPicErrorMsg('');
    setPicBusy('Removing picture…');
    try {
      await removeArtistPicture({ repo: d.repo, photos: d.photos, artistIds: folder.artistIds, oldPaths });
      await d.reload();
    } catch (e) {
      setPicError(true);
      setPicErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setPicBusy(null);
    }
  };

  const savePosition = async () => {
    if (!folder) return;
    try {
      for (const id of folder.artistIds) {
        await d.repo.updateArtist(id, { avatarPosition: `50% ${posY}%` });
      }
      await d.reload();
    } catch (e) {
      setPicError(true);
      setPicErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <main className="page journal">
      <Link to="/" className="back"><ChevronLeft size={18} aria-hidden /> Collection</Link>
      {!folder ? (
        <p className="empty">This artist has no sheets.</p>
      ) : (
        <>
          <header className="journal-head artist-head">
            {canPicture && (
              <div className="artist-pic">{(avatarUrl || coverUrl) ? <img src={(avatarUrl || coverUrl)!} alt="" /> : null}</div>
            )}
            <div>
              <h1>{folder.name}</h1>
              <p className="sub">{folder.owned} {folder.owned === 1 ? 'sheet' : 'sheets'} owned{folder.usedUp > 0 ? ` · ${folder.usedUp} used up` : ''}</p>
            </div>
          </header>
          {canPicture && (
            <div className="pic-actions">
              {!cropImg && (
                <label className="button-like">Change picture
                  <input type="file" accept="image/*" style={{ display: 'none' }} disabled={!!picBusy}
                    onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; if (f) void pickPicture(f); }} />
                </label>
              )}
              {cropImg && cropSrc && cropRect && (
                <>
                  <CropBox src={cropSrc} naturalW={cropImg.width} naturalH={cropImg.height} value={cropRect} onChange={setCropRect} />
                  <div className="row">
                    <button type="button" disabled={!!picBusy} onClick={() => void rotateCrop(-1)}>Rotate left</button>
                    <button type="button" disabled={!!picBusy} onClick={() => void rotateCrop(1)}>Rotate right</button>
                  </div>
                  <div className="row">
                    <button type="button" disabled={!!picBusy} onClick={() => void savePicture()}>Save picture</button>
                    <button type="button" disabled={!!picBusy} onClick={cancelPicture}>Cancel</button>
                  </div>
                </>
              )}
              {!cropImg && folder.avatarPath && <button type="button" disabled={!!picBusy} onClick={() => void removePicture()}>Remove picture</button>}
              {!cropImg && folder.avatarPath && (
                <label style={{ display: 'block', marginTop: 8 }}>
                  Vertical position
                  <input type="range" min={0} max={100} value={posY}
                    onChange={(e) => setPosY(Number(e.target.value))}
                    onMouseUp={() => void savePosition()}
                    onTouchEnd={() => void savePosition()} />
                </label>
              )}
              {picBusy && <p className="hint">{picBusy}</p>}
              {picError && <p className="error">Couldn't save the picture. Try again.{picErrorMsg && ` (${picErrorMsg})`}</p>}
            </div>
          )}
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
