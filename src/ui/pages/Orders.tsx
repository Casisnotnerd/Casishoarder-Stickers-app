import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Order } from '../../domain/types';
import { formatMoney } from '../../domain/currency';
import { effectiveSgdPaidMinor, linesOf } from '../../domain/money';
import { orderToForm, parseOrderForm, type OrderForm } from '../../domain/orderForm';
import { useData } from '../DataProvider';
import { OrderFields } from '../OrderFields';

export function Orders() {
  const d = useData();
  const [params] = useSearchParams();
  const [onlyMissing, setOnlyMissing] = useState(params.get('missing') === '1');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<OrderForm | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const rows = d.orders
    .filter((o) => !o.isUnknown)
    .filter((o) => !onlyMissing || effectiveSgdPaidMinor(o, linesOf(o, d.lines)) === null)
    .sort((a, b) => (b.orderDate ?? '').localeCompare(a.orderDate ?? '') || b.createdAt.localeCompare(a.createdAt));

  const startEdit = (o: Order) => { setEditId(o.id); setForm(orderToForm(o)); setMsg(null); };
  const save = async () => {
    if (!editId || !form) return;
    const p = parseOrderForm(form);
    if (!p.ok) { setMsg(p.error); return; }
    await d.repo.updateOrder(editId, p.value);
    await d.reload();
    setEditId(null);
  };

  return (
    <main className="page">
      <h1>Orders</h1>
      <label><input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />Only orders missing SGD</label>
      {rows.map((o) => {
        const ol = linesOf(o, d.lines);
        const sheets = ol.reduce((n, l) => n + l.quantity, 0);
        return (
          <div key={o.id} className="card">
            {editId === o.id && form ? (
              <>
                <OrderFields value={form} onChange={setForm} />
                {msg && <p className="error">{msg}</p>}
                <button className="primary" onClick={() => void save()}>Save</button>
                <button onClick={() => setEditId(null)}>Cancel</button>
              </>
            ) : (
              <div className="row">
                <span>{o.orderDate ?? 'No date'}{o.estimated ? ' (est.)' : ''} · {o.shop ?? 'No shop'} · {sheets} sheet{sheets === 1 ? '' : 's'}</span>
                <span>{formatMoney(o.totalMinor, o.currency)} → {formatMoney(effectiveSgdPaidMinor(o, ol), 'SGD')}</span>
                <button onClick={() => startEdit(o)}>Edit</button>
                <Link className="button-link" to={`/bulk?order=${o.id}`}>Add photos</Link>
              </div>
            )}
          </div>
        );
      })}
      {rows.length === 0 && <p className="hint">Nothing here.</p>}
    </main>
  );
}
