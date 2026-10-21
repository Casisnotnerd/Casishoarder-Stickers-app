import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EMPTY_ORDER_FORM, parseOrderForm, type OrderForm } from '../../domain/orderForm';
import { derivedRate, orderMismatch } from '../../domain/money';
import { formatMoney, toMinor } from '../../domain/currency';
import type { Order, OrderLine } from '../../domain/types';
import { useData } from '../DataProvider';
import { OrderFields } from '../OrderFields';
import { SheetDraftEditor } from '../SheetDraftEditor';
import { saveOrder, type DraftLine } from '../saveOrder';

export function AddOrder() {
  const data = useData();
  const nav = useNavigate();
  const [unknownOrder, setUnknown] = useState(false);
  const [form, setForm] = useState<OrderForm>(EMPTY_ORDER_FORM);
  const [drafts, setDrafts] = useState<DraftLine[]>([]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const currency = unknownOrder ? 'SGD' : form.currency;

  // Live preview of the derived rate and mismatch warning.
  const parsed = parseOrderForm(form);
  const preview = parsed.ok && !unknownOrder ? (() => {
    const o: Order = { ...parsed.value, id: 'draft', isUnknown: false, createdAt: '' };
    const ls: OrderLine[] = drafts.map((d) => ({
      id: d.key, orderId: 'draft', sheetId: d.key, quantity: Number(d.quantity) || 0,
      priceMinor: d.price.trim() ? toMinor(d.price, o.currency) : null, estimated: d.estimated,
    }));
    return { rate: derivedRate(o, ls), mismatch: orderMismatch(o, ls), currency: o.currency };
  })() : null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await saveOrder({ repo: data.repo, photos: data.photos, form, unknownOrder, drafts });
      if (!r.ok) { setError(r.error); return; }
      await data.reload();
      nav('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page">
      <h1>Add sheets</h1>
      <Link to="/bulk" className="card bulk-link">
        <b>Lots of sheets?</b>
        <span>Photograph several sheets at once and fill in the details together.</span>
      </Link>
      <label>
        <input type="checkbox" checked={unknownOrder} onChange={(e) => setUnknown(e.target.checked)} />
        Old sheets: I don't know the order (date / price unknown)
      </label>
      {!unknownOrder && <OrderFields value={form} onChange={setForm} />}
      {preview?.rate != null && preview.currency !== 'SGD' && (
        <p className="hint">Rate from your payment: 1 {preview.currency} = S${preview.rate.toPrecision(3)}</p>
      )}
      {preview?.mismatch && drafts.length > 0 && !editing && (
        <p className="warn">Order total {formatMoney(preview.mismatch.totalMinor, preview.currency)} ≠ sheets + shipping
          {' '}{formatMoney(preview.mismatch.expectedMinor, preview.currency)} (difference {formatMoney(preview.mismatch.diffMinor, preview.currency)}).
          Both will be saved.</p>
      )}

      <h2>Sheets in this {unknownOrder ? 'batch' : 'order'} ({drafts.length})</h2>
      {drafts.map((d) => (
        <div key={d.key} className="card row">
          <span>{d.title || '(existing sheet)'} ×{d.quantity}{d.price ? ` · ${d.price} ${currency}` : ''}</span>
          <button onClick={() => setDrafts(drafts.filter((x) => x.key !== d.key))}>Remove</button>
        </div>
      ))}
      {editing ? (
        <SheetDraftEditor currency={currency} onCancel={() => setEditing(false)}
          onDone={(d) => { setDrafts([...drafts, d]); setEditing(false); }} />
      ) : (
        <button onClick={() => setEditing(true)}>📷 Add a sheet</button>
      )}

      {error && <p className="error">{error}</p>}
      <div>
        <button className="primary" disabled={saving || drafts.length === 0 || editing} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </main>
  );
}
