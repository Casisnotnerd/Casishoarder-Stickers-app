import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { cropToJpeg, loadImage, PHOTO, THUMB } from '../../image/crop';
import { detectSheetsInImage } from '../../image/detect';
import { fullRect, type Rect } from '../../image/geometry';
import { computeImageHash, hammingDistance } from '../../image/hash';
import { guessTitle } from '../../domain/titleGuess';
import { findArtistByName, findSameTitle } from '../../domain/duplicates';
import { copiesOwned } from '../../domain/holdings';
import { formatMoney } from '../../domain/currency';
import { effectiveSgdPaidMinor, linesOf } from '../../domain/money';
import { useData } from '../DataProvider';
import { BoxEditor } from '../BoxEditor';
import { saveBatch, type BatchOrderInfo, type BatchRow } from '../saveBatch';

type Step = 'order' | 'photo' | 'details' | 'titles' | 'saved';

interface UiRow extends BatchRow {
  thumbUrl: string | null;
  suggestion: string; // title read from the photo; shown as a tap-to-use button, never filled in by itself
  own: boolean; // this sheet has its own artist / price (different from the photo)
  dismissed: boolean; // user said "it's a different sheet"
}

const copyText = (n: number) => `${n} ${n === 1 ? 'copy' : 'copies'}`;
const money = (currency: string) => (currency === 'SGD' ? 'S$' : currency);

export function BulkAdd() {
  const data = useData();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const continuing = params.get('order');
  const existingOrder = continuing ? data.orders.find((o) => o.id === continuing) ?? null : null;

  const [orderId, setOrderId] = useState<string | null>(existingOrder?.id ?? null);
  const currency = existingOrder?.currency ?? 'SGD';
  const [step, setStep] = useState<Step>(existingOrder ? 'photo' : 'order');
  const [info, setInfo] = useState<BatchOrderInfo>({ date: '', shop: '', shipping: '' });

  const [img, setImg] = useState<ImageBitmap | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<Rect[]>([]);
  const [artist, setArtist] = useState('');
  const [price, setPrice] = useState('');
  const [tags, setTags] = useState('');
  const [suggest, setSuggest] = useState(true);
  const [rows, setRows] = useState<UiRow[]>([]);
  const [ocr, setOcr] = useState<{ done: number; total: number; failed: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState(0);
  const stopOcr = useRef(false);

  useEffect(() => () => { stopOcr.current = true; }, []);
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const order = orderId ? data.orders.find((o) => o.id === orderId) ?? null : null;
  const orderSummary = useMemo(() => {
    if (!order) return null;
    const ol = linesOf(order, data.lines);
    return { sheets: ol.reduce((n, l) => n + l.quantity, 0), paid: effectiveSgdPaidMinor(order, ol) };
  }, [order, data.lines]);

  if (continuing && !existingOrder && !data.loading) {
    return <main className="page"><h1>Add many sheets</h1><p className="error">That order wasn't found.</p><Link to="/orders">Back to orders</Link></main>;
  }

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy('Finding sheets…');
    try {
      const bmp = await loadImage(file);
      setImg(bmp);
      setSrc(URL.createObjectURL(file));
      const found = detectSheetsInImage(bmp);
      setBoxes(found.length ? found : [fullRect(bmp.width, bmp.height)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const rotate = async (dir: 1 | -1) => {
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = img.height;
    canvas.height = img.width;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((dir * Math.PI) / 2);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    const bmp = await createImageBitmap(canvas);
    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.92));
    setImg(bmp);
    setSrc(URL.createObjectURL(blob));
    const found = detectSheetsInImage(bmp);
    setBoxes(found.length ? found : [fullRect(bmp.width, bmp.height)]);
  };

  const readTitles = async (made: UiRow[]) => {
    stopOcr.current = false;
    setOcr({ done: 0, total: made.length, failed: false });
    try {
      const { createOcrReader } = await import('../../image/ocr');
      const reader = await createOcrReader();
      try {
        for (const [i, r] of made.entries()) {
          if (stopOcr.current) break;
          const guess = r.photo ? guessTitle(await reader.read(r.photo)) : '';
          if (guess) setRows((cur) => cur.map((x) => (x.key === r.key ? { ...x, suggestion: guess } : x)));
          setOcr({ done: i + 1, total: made.length, failed: false });
        }
      } finally {
        await reader.close();
      }
    } catch {
      setOcr((o) => (o ? { ...o, failed: true } : o));
    }
  };

  const cutOut = async () => {
    if (!img) return;
    setBusy('Cutting out sheets…');
    try {
      const made: UiRow[] = [];
      for (const b of boxes) {
        const photo = await cropToJpeg(img, b, PHOTO.maxSide, PHOTO.quality);
        const thumb = await cropToJpeg(img, b, THUMB.maxSide, THUMB.quality);
        let imageHash: string | null = null;
        try { imageHash = await computeImageHash(thumb); } catch { /* duplicate check by photo just skipped */ }
        made.push({
          key: crypto.randomUUID(), photo, thumb, imageHash, thumbUrl: URL.createObjectURL(thumb),
          title: '', artistName: artist, price, existingSheetId: null, suggestion: '', own: false, dismissed: false,
        });
      }
      setRows(made);
      setStep('titles');
      if (suggest) void readTitles(made);
      else setOcr(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const patch = (key: string, p: Partial<UiRow>) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const save = async () => {
    setError(null);
    setBusy('Saving…');
    try {
      const final = rows.map((x) => (x.own ? x : { ...x, artistName: artist, price }));
      const r = await saveBatch({ repo: data.repo, photos: data.photos, orderId, currency, info, tags, rows: final });
      if (!r.ok) { setError(r.error); return; }
      stopOcr.current = true;
      setOrderId(r.orderId);
      setLastSaved(r.saved);
      rows.forEach((x) => x.thumbUrl && URL.revokeObjectURL(x.thumbUrl));
      setRows([]);
      setImg(null);
      setSrc(null);
      setBoxes([]);
      await data.reload();
      setStep('saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const steps: Step[] = ['photo', 'details', 'titles'];
  const stepNo = steps.indexOf(step) + 1;

  return (
    <main className="page bulk">
      <h1>Add many sheets</h1>
      {order && orderSummary && (
        <p className="sub">Order: {order.orderDate ?? 'no date'} · {order.shop ?? 'no shop'} · {orderSummary.sheets} sheet{orderSummary.sheets === 1 ? '' : 's'} so far</p>
      )}
      {stepNo > 0 && <p className="steps">Step {stepNo} of 3 · {['Find the sheets', 'Same for the whole photo', 'Titles'][stepNo - 1]}</p>}

      {step === 'order' && (
        <section className="card">
          <h2>Order details</h2>
          <p className="hint">Asked once. Leave anything you don't know empty. You can add as many photos to this order as you need.</p>
          <label>Shop<input value={info.shop} onChange={(e) => setInfo({ ...info, shop: e.target.value })} /></label>
          <div className="row">
            <label>Bought on<input type="date" value={info.date} onChange={(e) => setInfo({ ...info, date: e.target.value })} /></label>
            <label>Shipping (S$)<input inputMode="decimal" value={info.shipping} onChange={(e) => setInfo({ ...info, shipping: e.target.value })} /></label>
          </div>
          <button className="primary" onClick={() => setStep('photo')}>Next: take a photo</button>
          <p className="hint">Only one sheet? <Link to="/add">Add a single sheet</Link></p>
        </section>
      )}

      {step === 'photo' && (
        <section>
          {!img && (
            <div className="card">
              <p className="hint">Lay up to about 12 sheets on a plain, darker background, leave a small gap between them, and shoot from straight above. Copies of the same sheet can be stacked: they count as one sheet.</p>
              <label className="filepick">Choose or take a photo
                <input type="file" accept="image/*" onChange={(e) => void pick(e.target.files?.[0])} />
              </label>
            </div>
          )}
          {img && src && (
            <>
              <p><b>{boxes.length} sheet{boxes.length === 1 ? '' : 's'} found.</b> Check each box.</p>
              <BoxEditor src={src} naturalW={img.width} naturalH={img.height} boxes={boxes} onChange={setBoxes} />
              <div className="row">
                <button type="button" onClick={() => void rotate(-1)}>Rotate left</button>
                <button type="button" onClick={() => void rotate(1)}>Rotate right</button>
                <button type="button" onClick={() => { setImg(null); setSrc(null); setBoxes([]); }}>Different photo</button>
              </div>
              <button className="primary" disabled={boxes.length === 0} onClick={() => setStep('details')}>Next</button>
            </>
          )}
        </section>
      )}

      {step === 'details' && (
        <section className="card">
          <h2>Same for all {boxes.length} sheets</h2>
          <label>Artist
            <input list="bulk-artists" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="papermilio" />
            <datalist id="bulk-artists">{data.artists.map((a) => <option key={a.id} value={a.name} />)}</datalist>
          </label>
          <label>{money(currency)} each<input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="3.50" /></label>
          <label>Tags (comma-separated, optional)<input value={tags} onChange={(e) => setTags(e.target.value)} /></label>
          <label><input type="checkbox" checked={suggest} onChange={(e) => setSuggest(e.target.checked)} />Suggest titles from the photo</label>
          <p className="hint">Each sheet starts with 1 copy. If one sheet has a different artist or price, you can change just that sheet on the next screen.</p>
          <button onClick={() => setStep('photo')}>Back</button>
          <button className="primary" disabled={!!busy} onClick={() => void cutOut()}>Next</button>
        </section>
      )}

      {step === 'titles' && (
        <section>
          <p className="shared-line">All sheets: <b>{artist.trim() || 'no artist'}</b> · {price.trim() ? `${money(currency)}${price.trim()} each` : 'no price'}{' '}
            <button type="button" className="linkish" onClick={() => { stopOcr.current = true; setStep('details'); }}>Change</button></p>
          {ocr && !ocr.failed && ocr.done < ocr.total && (
            <p className="hint">Reading titles from the photo… {ocr.done}/{ocr.total}{' '}
              <button type="button" onClick={() => { stopOcr.current = true; setOcr(null); }}>Stop</button></p>
          )}
          {ocr?.failed && <p className="hint">Couldn't read titles from the photo. Type them in.</p>}
          {rows.map((r, i) => (
            <RowEditor key={r.key} n={i + 1} row={r} currency={currency} photoArtist={artist} photoPrice={price} onChange={(p) => patch(r.key, p)}
              onRemove={() => setRows((cur) => cur.filter((x) => x.key !== r.key))} />
          ))}
          {rows.length === 0 && <p className="hint">No sheets left. Go back to add a box.</p>}
          <button onClick={() => { stopOcr.current = true; setStep('details'); }}>Back</button>
          <button className="primary" disabled={!!busy || rows.length === 0} onClick={() => void save()}>
            Save {rows.length} sheet{rows.length === 1 ? '' : 's'}
          </button>
        </section>
      )}

      {step === 'saved' && orderSummary && (
        <section className="card">
          <h2>Saved {lastSaved} sheet{lastSaved === 1 ? '' : 's'}</h2>
          <p>This order now has <b>{orderSummary.sheets} sheet{orderSummary.sheets === 1 ? '' : 's'}</b>
            {orderSummary.paid !== null && <> · <b>{formatMoney(orderSummary.paid, 'SGD')}</b> including shipping</>}.</p>
          <button className="primary" onClick={() => setStep('photo')}>Add another photo to this order</button>
          <button onClick={() => nav('/')}>Finish</button>
          <p className="hint">You can come back to this order later from Spending → All orders → Add photos.</p>
        </section>
      )}

      {busy && <p className="hint">{busy}</p>}
      {error && <p className="error">{error}</p>}
    </main>
  );
}

function RowEditor({ n, row, currency, photoArtist, photoPrice, onChange, onRemove }: {
  n: number; row: UiRow; currency: string; photoArtist: string; photoPrice: string;
  onChange: (p: Partial<UiRow>) => void; onRemove: () => void;
}) {
  const data = useData();
  const existing = row.existingSheetId ? data.sheets.find((s) => s.id === row.existingSheetId) ?? null : null;
  const artistName = row.own ? row.artistName : photoArtist;
  const artistId = findArtistByName(artistName, data.artists)?.id ?? null;
  const same = !row.dismissed && !existing ? findSameTitle(row.title, artistId, data.sheets) : null;
  const look = !row.dismissed && !existing && !same && row.imageHash
    ? data.sheets.find((s) => s.imageHash && hammingDistance(s.imageHash, row.imageHash!) <= 10) ?? null
    : null;
  const dup = same ?? look;
  const showSuggestion = !existing && row.suggestion && row.suggestion !== row.title.trim();

  return (
    <div className="card bulk-row">
      <div className="bulk-row-head">
        {row.thumbUrl ? <img src={row.thumbUrl} alt={`Sheet ${n}`} /> : <span className="thumb-empty" />}
        <div className="bulk-row-fields">
          {existing ? (
            <p className="warn">Adding 1 copy to <b>{existing.title}</b>.{' '}
              <button type="button" onClick={() => onChange({ existingSheetId: null, dismissed: true })}>Undo</button></p>
          ) : (
            <label>Sheet {n} title
              <input value={row.title} placeholder="Type a title" onChange={(e) => onChange({ title: e.target.value })} />
            </label>
          )}
          {showSuggestion && (
            <button type="button" className="suggestion" onClick={() => onChange({ title: row.suggestion })}>
              Use: {row.suggestion}
            </button>
          )}
        </div>
        <button type="button" className="danger" aria-label={`Remove sheet ${n}`} onClick={onRemove}>Remove</button>
      </div>
      {row.own ? (
        <div className="row">
          {!existing && (
            <label>Artist<input list="bulk-artists-row" value={row.artistName} onChange={(e) => onChange({ artistName: e.target.value })} />
              <datalist id="bulk-artists-row">{data.artists.map((a) => <option key={a.id} value={a.name} />)}</datalist>
            </label>
          )}
          <label>{money(currency)} each<input inputMode="decimal" value={row.price} onChange={(e) => onChange({ price: e.target.value })} /></label>
          <button type="button" className="linkish" onClick={() => onChange({ own: false })}>Same as the photo</button>
        </div>
      ) : (
        <button type="button" className="linkish" onClick={() => onChange({ own: true, artistName: photoArtist, price: photoPrice })}>
          Different artist or price?
        </button>
      )}
      {dup && (
        <div className="warn">
          {same ? 'You already have' : 'This looks like'} <b>{dup.title}</b> ({copyText(copiesOwned(dup.id, data.lines, data.usages))}).
          <div>
            <button type="button" onClick={() => onChange({ existingSheetId: dup.id })}>Add a copy to it</button>
            <button type="button" onClick={() => onChange({ dismissed: true })}>It's a different sheet</button>
          </div>
        </div>
      )}
    </div>
  );
}
