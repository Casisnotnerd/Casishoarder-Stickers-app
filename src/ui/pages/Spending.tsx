import { useMemo, type CSSProperties } from 'react';
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

export function Spending() {
  const d = useData();
  const s = useMemo(() => summarizeSpending(d), [d]);
  const idByName = useMemo(() => new Map(d.artists.map((a) => [a.name, a.id])), [d.artists]);
  const missing = s.missingSgdOrderIds.length;
  return (
    <main className="page">
      <h1>Spending</h1>
      <p className="sub">All amounts in SGD, from what you paid</p>
      <div className="card">
        <div className="total" data-testid="total">{formatMoney(s.totalMinor, 'SGD')}</div>
        <div className="hint">Exact {formatMoney(s.exactMinor, 'SGD')} · Estimated {formatMoney(s.estimatedMinor, 'SGD')}</div>
        <div className="hint">Includes shipping {formatMoney(s.shippingMinor, 'SGD')}
          {s.otherMinor !== 0 && <> · discounts and rounding {formatMoney(s.otherMinor, 'SGD')}</>}</div>
      </div>
      {missing > 0 && (
        <p className="warn">{missing} order{missing === 1 ? ' is' : 's are'} missing the SGD amount and not counted.{' '}
          <Link to="/orders?missing=1">Fill in</Link></p>
      )}
      <h2>By artist</h2>
      <Bars items={s.byArtist} colorOf={(name) => {
        const id = idByName.get(name);
        return id ? artistColor(id).tab : undefined;
      }} />
      <h2>By month</h2>
      <Bars items={s.byMonth} />
      <p style={{ marginTop: 24 }}>
        <Link to="/orders">All orders</Link>{' · '}
        <button onClick={() => downloadText('sticker-collection.csv', collectionCsv(d))}>Export CSV</button>
      </p>
    </main>
  );
}
