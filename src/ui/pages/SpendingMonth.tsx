import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { summarizeSpending } from '../../domain/spending';
import { formatMoney } from '../../domain/currency';
import { artistColor } from '../../domain/artistColor';
import { useData } from '../DataProvider';
import { BackButton } from '../BackButton';
import { Bars } from '../Bars';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const LONG = new Intl.DateTimeFormat('en-SG', { month: 'long', year: 'numeric' });

/** What you spent in one month (by order date), and on which artists. */
export function SpendingMonth() {
  const { month = '' } = useParams();
  const d = useData();
  const ok = MONTH.test(month);
  const s = useMemo(() => (ok ? summarizeSpending(d, null, month) : null), [d, month, ok]);
  const idByName = useMemo(() => new Map(d.artists.map((a) => [a.name, a.id])), [d.artists]);

  if (!ok || !s) {
    return <main className="page"><BackButton fallback="/spending" /><p className="empty">That month wasn't found.</p></main>;
  }
  const title = LONG.format(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
  return (
    <main className="page">
      <BackButton fallback={`/spending?year=${month.slice(0, 4)}`} />
      <h1>{title}</h1>
      <div className="card">
        <div className="total" data-testid="month-total">{formatMoney(s.totalMinor, 'SGD')}</div>
        <div className="hint">Includes shipping {formatMoney(s.shippingMinor, 'SGD')}</div>
      </div>
      <h2>By artist</h2>
      <Bars items={s.byArtist} colorOf={(name) => {
        const id = idByName.get(name);
        return id ? artistColor(id).ink : undefined;
      }} />
    </main>
  );
}
