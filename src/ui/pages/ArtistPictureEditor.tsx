import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { artistFolders, UNKNOWN_FOLDER } from '../../domain/folders';
import { DEFAULT_FRAME, frameLayout, MAX_ZOOM, MIN_ZOOM, panFrame, parseFrame, TILE_ASPECT, zoomFrame, type TileFrame } from '../../domain/tileFrame';
import { loadImage } from '../../image/crop';
import { useData } from '../DataProvider';
import { usePhotoUrl } from '../usePhotoUrl';
import { BackButton, useGoBack } from '../BackButton';
import { removeArtistPicture, setArtistFrame, setArtistPicture } from '../artistPicture';

/** A picked or rotated photo that hasn't been saved yet. */
interface NewPhoto { blob: Blob; url: string }

async function rotated(src: string, dir: 1 | -1): Promise<Blob> {
  const img = await loadImage(await (await fetch(src)).blob());
  const canvas = document.createElement('canvas');
  canvas.width = img.height;
  canvas.height = img.width;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available.');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((dir * Math.PI) / 2);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not rotate.'))), 'image/jpeg', 0.92));
}

/** Full-screen editor for an artist's tile picture: move, zoom and rotate it inside a tile-shaped frame. */
export function ArtistPictureEditor() {
  const { id } = useParams();
  const d = useData();
  const goBack = useGoBack('/');
  const folder = useMemo(() => artistFolders(d.artists, d.sheets, d.lines, d.usages).find((f) => f.id === id) ?? null,
    [id, d.artists, d.sheets, d.lines, d.usages]);
  const saved = usePhotoUrl('thumbs', folder?.avatarPath ?? null);
  const [fresh, setFresh] = useState<NewPhoto | null>(null);
  const [frame, setFrame] = useState<TileFrame>(() => parseFrame(folder?.avatarPosition));
  const [aspect, setAspect] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => () => { if (fresh) URL.revokeObjectURL(fresh.url); }, [fresh]);

  if (!folder || folder.id === UNKNOWN_FOLDER) {
    return <main className="page"><BackButton fallback="/" /><p className="empty">This artist wasn't found.</p></main>;
  }

  const src = fresh?.url ?? saved;
  const I = aspect ?? TILE_ASPECT;
  const layout = frameLayout(frame, I);
  const oldPaths = [...new Set(d.artists.filter((a) => folder.artistIds.includes(a.id)).map((a) => a.avatarPath).filter((p): p is string => !!p))];

  const takePhoto = (blob: Blob) => {
    setFresh({ blob, url: URL.createObjectURL(blob) });
    setAspect(null);
    setFrame({ ...DEFAULT_FRAME });
  };

  const run = async (label: string, work: () => Promise<void>, leave: boolean) => {
    setError(false);
    setBusy(label);
    try {
      await work();
      if (leave) { await d.reload(); goBack(); }
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  const save = () => run('Saving picture…', async () => {
    if (fresh) await setArtistPicture({ repo: d.repo, photos: d.photos, artistIds: folder.artistIds, oldPaths, file: fresh.blob, frame });
    else await setArtistFrame({ repo: d.repo, artistIds: folder.artistIds, frame });
  }, true);
  const remove = () => run('Removing picture…', () => removeArtistPicture({ repo: d.repo, photos: d.photos, artistIds: folder.artistIds, oldPaths }), true);
  const rotate = (dir: 1 | -1) => src && run('Rotating…', async () => takePhoto(await rotated(src, dir)), false);

  const down = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: frame.zoom };
    }
  };
  const move = (e: React.PointerEvent) => {
    const last = pointers.current.get(e.pointerId);
    if (!last) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current.dist > 0) setFrame((f) => zoomFrame(f, pinch.current!.zoom * (dist / pinch.current!.dist), I));
    } else {
      const w = box.current?.clientWidth ?? 0;
      if (w > 0) setFrame((f) => panFrame(f, e.clientX - last.x, e.clientY - last.y, w, I));
    }
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  return (
    <main className="page picture-editor">
      <BackButton fallback="/" />
      <h1>Picture for {folder.name}</h1>
      {src ? (
        <>
          <p className="hint">Drag to move. Pinch or use the slider to zoom.</p>
          <div ref={box} className="editor-frame" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            <img src={src} alt={`Picture for ${folder.name}`} draggable={false}
              style={{ width: `${layout.widthPct}%`, height: `${layout.heightPct}%`, left: `${layout.leftPct}%`, top: `${layout.topPct}%` }}
              onLoad={(e) => {
                const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                if (w && h) { setAspect(w / h); setFrame((f) => zoomFrame(f, f.zoom, w / h)); }
              }} />
          </div>
          <label className="zoom">Zoom
            <input type="range" aria-label="Zoom" min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={frame.zoom}
              onChange={(e) => setFrame((f) => zoomFrame(f, Number(e.target.value), I))} />
          </label>
          <div className="row">
            <button type="button" disabled={!!busy} onClick={() => void rotate(-1)}>Rotate left</button>
            <button type="button" disabled={!!busy} onClick={() => void rotate(1)}>Rotate right</button>
          </div>
        </>
      ) : (
        <p className="hint">Choose a photo for this tile.</p>
      )}
      <div className="editor-actions">
        <label className="button-like">Change photo
          <input type="file" accept="image/*" style={{ display: 'none' }} disabled={!!busy}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) takePhoto(f); }} />
        </label>
        {folder.avatarPath && <button type="button" disabled={!!busy} onClick={() => void remove()}>Remove picture</button>}
        <button type="button" onClick={goBack}>Cancel</button>
        {src && <button type="button" className="primary" disabled={!!busy} onClick={() => void save()}>Save</button>}
      </div>
      {busy && <p className="hint">{busy}</p>}
      {error && <p className="error">Couldn't save the picture. Try again.</p>}
    </main>
  );
}
