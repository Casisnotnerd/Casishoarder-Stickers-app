import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { summarizeSpending, type Bucket } from '../../domain/spending';
import { formatMoney } from '../../domain/currency';
import { collectionCsv } from '../../domain/csv';
import { artistColor } from '../../domain/artistColor';
import { useData } from '../DataProvider';
import { downloadText } from '../download';

function Bars({ items, colorOf }: { items: Bucket[]; colorOf?: (label: string) => string | undefined }) {
  const max = Math.max(1, ...items.map((b) => Math.abs(b.minor)));
  return (
    <div className="bars">
      {items.map((b) => (
        <div className="barrow" key={b.label}>
          <span>{b.label}</span>
          <span className="amt">{formatMoney(b.minor, 'SGD')}</span>
          <div className="track">
            <div className="fill" style={{ width: `${(Math.abs(b.minor) / max) * 100}%`, '--tab': colorOf?.(b.label) } as CSSProperties} />
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="hint">Nothing to show yet.</p>}
    </div>
  );
}

function last12Months(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export function Spending() {
  const d = useData();
  const [filterArtistId, setFilterArtistId] = useState<string | null>(null);
  const s = useMemo(() => summarizeSpending(d, filterArtistId), [d, filterArtistId]);
  const idByName = useMemo(() => new Map(d.artists.map((a) => [a.id, a.name])), [d.artists]);

  const monthMap = useMemo(() => new Map(s.byMonth.map((b) => [b.label, b.minor])), [s.byMonth]);
  const months12 = useMemo(() => last12Months(), []);
  const missing = s.missingSgdOrderIds.length;
  return (
    <main className="page">
      <h1>Spending</h1>
      <p className="sub">All amounts in SGD, from what you paid</p>

      <div className="row" style={{ marginBottom: 12 }}>
        <label style={{ flex: 1 }}>Artist
          <select value={filterArtistId ?? ''} onChange={(e) => setFilterArtistId(e.target.value || null)}>
            <option value="">All artists</option>
            {[...d.artists].sort((a, b) => a.name.localeCompare(b.name)).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="card">
        <div className="total" data-testid="total">{formatMoney(s.totalMinor, 'SGD')}</div>
        <div className="hint">Exact {formatMoney(s.exactMinor, 'SGD')} · Estimated {formatMoney(s.estimatedMinor, 'SGD')}</div>
        {filterArtistId === null && (
          <div className="hint">Includes shipping {formatMoney(s.shippingMinor, 'SGD')}
            {s.otherMinor !== 0 && <> · discounts and rounding {formatMoney(s.otherMinor, 'SGD')}</>}</div>
        )}
      </div>
      {missing > 0 && (
        <p className="warn">{missing} order{missing === 1 ? ' is' : 's are'} missing the SGD amount and not counted.{' '}
          <Link to="/orders?missing=1">Fill in</Link></p>
      )}

      <h2>Last 12 months</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
        {months12.map((m) => {
          const amt = monthMap.get(m) ?? 0;
          const now = new Date();
          const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          return (
            <div key={m} className="card" style={{ padding: 6, textAlign: 'center', background: m === cur ? 'var(--tab, #fff3cd)' : undefined }}>
              <div className="hint" style={{ fontSize: '0.75rem' }}>{m.slice(5)}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{formatMoney(amt, 'SGD')}</div>
            </div>
          );
        })}
      </div>

      {filterArtistId === null && (
        <>
          <h2>By artist</h2>
          <Bars items={s.byArtist} colorOf={(name) => {
            const id = idByName.get(name);
            return id ? artistColor(id).tab : undefined;
          }} />
        </>
      )}
      <h2>By month</h2>
      <Bars items={s.byMonth} />
      <p style={{ marginTop: 24 }}>
        <Link to="/orders">All orders</Link>{' · '}
        <button onClick={() => downloadText('sticker-collection.csv', collectionCsv(d))}>Export CSV</button>
      </p>
    </main>
  );
}