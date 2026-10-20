import { useState, type CSSProperties } from 'react';
import { artistColor } from '../../domain/artistColor';
import { useNavigate, useParams } from 'react-router-dom';
import { copiesOwned, copiesBought } from '../../domain/holdings';
import { formatMoney } from '../../domain/currency';
import { findArtistByName } from '../../domain/duplicates';
import { linesOf, lineSgdMinor, unitSgdMinor } from '../../domain/money';
import { useData } from '../DataProvider';
import { usePhotoUrl } from '../usePhotoUrl';

const today = () => new Date().toISOString().slice(0, 10);

export function SheetDetail() {
  const { id } = useParams();
  const d = useData();
  const nav = useNavigate();
  const sheet = d.sheets.find((s) => s.id === id);
  const photoUrl = usePhotoUrl('photos', sheet?.photoPath ?? null);
  const [useQty, setUseQty] = useState('1');
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [tags, setTags] = useState('');
  const [copies, setCopies] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  if (!sheet) return <main className="page"><p>Sheet not found.</p></main>;
  const artistName = d.artists.find((a) => a.id === sheet.artistId)?.name ?? '';
  const owned = copiesOwned(sheet.id, d.lines, d.usages);
  const myLines = d.lines.filter((l) => l.sheetId === sheet.id);
  const myUsages = d.usages.filter((u) => u.sheetId === sheet.id);

  const markUsed = async () => {
    setMsg(null);
    try {
      await d.repo.addUsage(sheet.id, Number(useQty), today());
      await d.reload();
      setUseQty('1');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async () => {
    let sgd = 0;
    for (const l of myLines) {
      const o = d.orders.find((x) => x.id === l.orderId);
      if (o) sgd += lineSgdMinor(l, o, linesOf(o, d.lines)) ?? 0;
    }
    const text = `Delete "${sheet.title}"?\n\nThis removes: the sheet, its photo, ${myLines.length} order line${myLines.length === 1 ? '' : 's'} (${formatMoney(sgd, 'SGD')}), ${myUsages.length} used-up record${myUsages.length === 1 ? '' : 's'}. Orders left with no sheets are removed too.\n\nTo record that you used a sheet, use "Mark used up" instead.`;
    if (!window.confirm(text)) return;
    try {
      if (sheet.photoPath) await d.photos.remove('photos', [sheet.photoPath]).catch(() => {});
      if (sheet.thumbPath) await d.photos.remove('thumbs', [sheet.thumbPath]).catch(() => {});
      await d.repo.deleteSheet(sheet.id);
      await d.reload();
      nav('/');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const saveEdit = async () => {
    let artistId: string | null = null;
    if (artist.trim()) artistId = (findArtistByName(artist, d.artists) ?? (await d.repo.createArtist(artist))).id;
    const normTags = tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    const uniqueTags = [...new Set(normTags)];
    await d.repo.updateSheet(sheet.id, {
      title: title.trim() || sheet.title, artistId, tags: uniqueTags,
    });
    const newCopies = Number(copies);
    if (Number.isInteger(newCopies) && newCopies >= 1) {
      if (myLines.length > 0) {
        const first = myLines[0];
        if (first.quantity !== newCopies) await d.repo.updateLine(first.id, { quantity: newCopies });
      } else {
        const o = await d.repo.getOrCreateUnknownOrder();
        await d.repo.addLine({ orderId: o.id, sheetId: sheet.id, quantity: newCopies, priceMinor: null, estimated: false });
      }
    }
    await d.reload();
    setEditing(false);
  };

  return (
    <main className="page" style={{ '--tab': artistColor(sheet.artistId).tab } as CSSProperties}>
      {photoUrl ? <img className="detail-photo" src={photoUrl} alt={sheet.title} /> : null}
      {editing ? (
        <div className="card">
          <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label>Artist<input value={artist} onChange={(e) => setArtist(e.target.value)} /></label>
          <label>Tags<input value={tags} onChange={(e) => setTags(e.target.value)} /></label>
          <label>Copies bought<input inputMode="numeric" value={copies} onChange={(e) => setCopies(e.target.value)} /></label>
          <button className="primary" onClick={() => void saveEdit()}>Save</button>
          <button onClick={() => setEditing(false)}>Cancel</button>
        </div>
      ) : (
        <div className="detail-head" style={{ '--tab': artistColor(sheet.artistId).tab } as CSSProperties}>
          <div className="who">
            <h1>{sheet.title}</h1>
            <div className="hint">{artistName || 'Unknown artist'}</div>
            {sheet.tags.map((t) => <span key={t} className="chip">{t}</span>)}
          </div>
          <div className="count" aria-label={owned > 0 ? `Own: ${owned} ${owned === 1 ? 'copy' : 'copies'}` : 'Used up'}>
            {owned > 0 ? owned : 0}<small>{owned === 1 ? 'copy' : 'copies'}</small>
          </div>
        </div>
      )}
      {!editing && (
        <button onClick={() => { setTitle(sheet.title); setArtist(artistName); setTags(sheet.tags.join(', ')); setCopies(String(copiesBought(sheet.id, d.lines))); setEditing(true); }}>Edit details</button>
      )}

      <div className="card">
        <p style={{ margin: '0 0 4px' }}><b>{owned > 0 ? 'Used some?' : 'All copies used up'}</b></p>
        {owned > 0 && (
          <div className="row">
            <label>Copies used<input inputMode="numeric" value={useQty} onChange={(e) => setUseQty(e.target.value)} /></label>
            <button onClick={() => void markUsed()}>Mark used up</button>
          </div>
        )}
        {msg && <p className="error">{msg}</p>}
      </div>

      <h2>Orders</h2>
      <table>
        <thead><tr><th>Date</th><th>Shop</th><th>Qty</th><th>Price each</th><th>S$ each</th></tr></thead>
        <tbody>
          {myLines.map((l) => {
            const o = d.orders.find((x) => x.id === l.orderId);
            if (!o) return null;
            return (
              <tr key={l.id}>
                <td>{o.isUnknown ? 'Unknown' : o.orderDate ?? '-'}{o.estimated || l.estimated ? ' (est.)' : ''}</td>
                <td>{o.shop ?? ''}</td>
                <td>
                  <input inputMode="numeric" defaultValue={l.quantity} style={{ width: 50 }}
                    onBlur={async (e) => {
                      const v = Number(e.target.value);
                      try { await d.repo.updateLine(l.id, { quantity: v }); await d.reload(); }
                      catch (err) { setMsg(err instanceof Error ? err.message : String(err)); }
                    }} />
                </td>
                <td>{formatMoney(l.priceMinor, o.currency)}</td>
                <td>{formatMoney(unitSgdMinor(l, o, linesOf(o, d.lines)), 'SGD')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {myUsages.length > 0 && (
        <>
          <h2>Used up</h2>
          <ul>{myUsages.map((u) => <li key={u.id}>{u.usedOn}: {u.quantity}</li>)}</ul>
        </>
      )}

      <h2>Mistake?</h2>
      <button className="danger" onClick={() => void remove()}>Delete sheet</button>
    </main>
  );
}
