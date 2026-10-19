import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { summarizeSpending, type Bucket } from '../../domain/spending';
import { formatMoney } from '../../domain/currency';
import { collectionCsv } from '../../domain/csv';
import { useData } from '../DataProvider';
import { downloadText } from '../download';

function Bars({ items }: { items: Bucket[] }) {
  const max = Math.max(1, ...items.map((b) => Math.abs(b.minor)));
  return (
    <table>
      <tbody>
        {items.map((b) => (
          <tr key={b.label}>
            <td style={{ width: '40%' }}>{b.label}</td>
            <td><div className="bar" style={{ width: `${(Math.abs(b.minor) / max) * 100}%` }} /></td>
            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatMoney(b.minor, 'SGD')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Spending() {
  const d = useData();
  const s = useMemo(() => summarizeSpending(d), [d]);
  const missing = s.missingSgdOrderIds.length;
  return (
    <main className="page">
      <h1>Spending</h1>
      <div className="card">
        <div style={{ fontSize: '1.6rem', fontWeight: 700 }} data-testid="total">{formatMoney(s.totalMinor, 'SGD')}</div>
        <div className="hint">Exact {formatMoney(s.exactMinor, 'SGD')} / Estimated {formatMoney(s.estimatedMinor, 'SGD')}</div>
        <div className="hint">Includes shipping {formatMoney(s.shippingMinor, 'SGD')}
          {s.otherMinor !== 0 && <> / discounts / rounding {formatMoney(s.otherMinor, 'SGD')}</>}</div>
      </div>
      {missing > 0 && (
        <p className="warn">{missing} order{missing === 1 ? ' is' : 's are'} missing the SGD amount and not counted.{' '}
          <Link to="/orders?missing=1">Fill in</Link></p>
      )}
      <h2>By artist</h2>
      <Bars items={s.byArtist} />
      <h2>By month</h2>
      <Bars items={s.byMonth} />
      <p>
        <Link to="/orders">All orders</Link>{' / '}
        <button onClick={() => downloadText('sticker-collection.csv', collectionCsv(d))}>Export CSV</button>
      </p>
    </main>
  );
}