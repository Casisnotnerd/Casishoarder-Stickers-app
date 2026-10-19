import { useEffect, useState } from 'react';
import type { DraftLine } from './saveOrder';
import { CropBox } from './CropBox';
import { cropToJpeg, loadImage, PHOTO, THUMB } from '../image/crop';
import { fullRect, type Rect } from '../image/geometry';
import { findArtistByName, findSameTitle } from '../domain/duplicates';
import { copiesOwned } from '../domain/holdings';
import { useData } from './DataProvider';

export function SheetDraftEditor({ currency, onDone, onCancel }: {
  currency: string;
  onDone: (d: DraftLine) => void;
  onCancel: () => void;
}) {
  const data = useData();
  const [img, setImg] = useState<ImageBitmap | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [tags, setTags] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [estimated, setEstimated] = useState(false);
  const [existingSheetId, setExisting] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const artistId = findArtistByName(artistName, data.artists)?.id ?? null;
  const same = !dismissed && !existingSheetId ? findSameTitle(title, artistId, data.sheets) : null;
  const existing = existingSheetId ? data.sheets.find((s) => s.id === existingSheetId) : null;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const bmp = await loadImage(file);
    setImg(bmp);
    setSrc(URL.createObjectURL(file));
    setRect(fullRect(bmp.width, bmp.height));
  };

  const done = async () => {
    setBusy(true);
    try {
      const photo = img && rect && !existingSheetId ? await cropToJpeg(img, rect, PHOTO.maxSide, PHOTO.quality) : null;
      const thumb = img && rect && !existingSheetId ? await cropToJpeg(img, rect, THUMB.maxSide, THUMB.quality) : null;
      onDone({
        key: crypto.randomUUID(), photo, thumb,
        title: existing ? existing.title : title, artistName, tags, quantity, price, estimated, existingSheetId,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Add a sheet</h2>
      {!existingSheetId && (
        <label>Photo or shop screenshot
          <input type="file" accept="image/*" onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
      )}
      {img && src && rect && !existingSheetId && (
        <CropBox src={src} naturalW={img.width} naturalH={img.height} value={rect} onChange={setRect} />
      )}
      {existing ? (
        <p className="warn">Adding copies to <b>{existing.title}</b>.{' '}
          <button onClick={() => setExisting(null)}>Undo</button></p>
      ) : (
        <>
          <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          {same && (
            <div className="warn">
              You already have <b>{same.title}</b> ({copiesOwned(same.id, data.lines, data.usages)} copies).
              <div>
                <button onClick={() => setExisting(same.id)}>Add copies to it</button>
                <button onClick={() => setDismissed(true)}>It's a different sheet</button>
              </div>
            </div>
          )}
          <label>Artist
            <input list="artist-names" value={artistName} onChange={(e) => setArtistName(e.target.value)} />
            <datalist id="artist-names">{data.artists.map((a) => <option key={a.id} value={a.name} />)}</datalist>
          </label>
          <label>Tags (comma-separated)<input value={tags} onChange={(e) => setTags(e.target.value)} /></label>
        </>
      )}
      <div className="row">
        <label>Copies<input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
        <label>Price each ({currency})<input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
      </div>
      <label><input type="checkbox" checked={estimated} onChange={(e) => setEstimated(e.target.checked)} />Price is a rough estimate</label>
      <button className="primary" disabled={busy || (!existingSheetId && !title.trim())} onClick={() => void done()}>
        {busy ? 'Preparing photo...' : 'Add to list'}
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}