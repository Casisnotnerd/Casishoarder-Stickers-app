import { useEffect, useState } from 'react';
import type { DraftLine } from './saveOrder';
import { CropBox } from './CropBox';
import { cropToJpeg, loadImage, PHOTO, THUMB } from '../image/crop';
import { fullRect, type Rect } from '../image/geometry';
import { computeImageHash, hammingDistance } from '../image/hash';
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
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string>('');
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrError, setOcrError] = useState<string>('');

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  useEffect(() => {
    if (!img || !rect || existingSheetId) { setOcrText(''); return; }
    let cancelled = false;
    setOcrBusy(true);
    (async () => {
      try {
        const photo = await cropToJpeg(img, rect, PHOTO.maxSide, PHOTO.quality);
        const { runOcr } = await import('../image/ocr');
        const text = await runOcr(photo);
        if (cancelled) return;
        setOcrText(text);
        setOcrError('');
        if (text && !title.trim()) {
          const firstLine = text.split(/\n/).map((l) => l.trim()).find((l) => l.length > 0);
          if (firstLine) setTitle(firstLine);
        }
      } catch (e) {
        if (!cancelled) { setOcrText(''); setOcrError(e instanceof Error ? e.message : String(e)); }
      } finally {
        if (!cancelled) setOcrBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [img, rect, existingSheetId]);

  useEffect(() => {
    if (!img || !rect || existingSheetId) { setImageHash(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const thumb = await cropToJpeg(img, rect, THUMB.maxSide, THUMB.quality);
        const h = await computeImageHash(thumb);
        if (!cancelled) setImageHash(h);
      } catch {
        if (!cancelled) setImageHash(null);
      }
    })();
    return () => { cancelled = true; };
  }, [img, rect, existingSheetId]);

  const artistId = findArtistByName(artistName, data.artists)?.id ?? null;
  const same = !dismissed && !existingSheetId ? findSameTitle(title, artistId, data.sheets) : null;
  const similarImage = !dismissed && !existingSheetId && imageHash
    ? data.sheets.find((s) => s.imageHash && hammingDistance(s.imageHash, imageHash) <= 10) ?? null
    : null;
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
      {img && !existingSheetId && (
        <div className="card">
          <p className="hint">OCR {ocrBusy ? '(reading text...)' : ''}</p>
          {ocrError && <p className="error">{ocrError}</p>}
          {ocrText && <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>{ocrText}</pre>}
          {!ocrText && !ocrBusy && !ocrError && <p className="hint">No text detected.</p>}
        </div>
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
          {similarImage && similarImage.id !== same?.id && (
            <div className="warn">
              This photo looks like <b>{similarImage.title}</b> you already have.
              <div>
                <button onClick={() => setExisting(similarImage.id)}>Add copies to it</button>
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