import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthsOfYear, noDateSgdMinor, spendingYears, summarizeSpending } from '../../domain/spending';
import { formatMoney } from '../../domain/currency';
import { collectionCsv } from '../../domain/csv';
import { artistColor } from '../../domain/artistColor';
import { useData } from '../DataProvider';
import { downloadText } from '../download';
import { Bars } from '../Bars';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthShort = (m: string) => MONTH_SHORT[Number(m.slice(5, 7)) - 1];

export function Spending() {
  const d = useData();
  const [filterArtistId, setFilterArtistId] = useState<string | null>(null);
  const s = useMemo(() => summarizeSpending(d, filterArtistId), [d, filterArtistId]);
  const idByName = useMemo(() => new Map(d.artists.map((a) => [a.name, a.id])), [d.artists]);

  const [params, setParams] = useSearchParams();
  const years = useMemo(() => spendingYears(d.orders), [d.orders]);
  const asked = Number(params.get('year'));
  const year = years.includes(asked) ? asked : years[years.length - 1];
  const yearTotal = useMemo(() => summarizeSpending(d, filterArtistId, String(year)).totalMinor, [d, filterArtistId, year]);
  const months = useMemo(
    () => monthsOfYear(year).map((m) => ({ m, minor: summarizeSpending(d, filterArtistId, m).totalMinor })),
    [d, filterArtistId, year],
  );
  const noDate = useMemo(() => noDateSgdMinor(d), [d]);
  const now = new Date();
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const goYear = (y: number) => setParams({ year: String(y) }, { replace: true });
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

      <div className="year-switch">
        {year > years[0] ? <button type="button" aria-label="Previous year" onClick={() => goYear(year - 1)}><ChevronLeft size={20} aria-hidden /></button> : <span className="year-gap" />}
        <span className="year">{year}</span>
        {year < years[years.length - 1] ? <button type="button" aria-label="Next year" onClick={() => goYear(year + 1)}><ChevronRight size={20} aria-hidden /></button> : <span className="year-gap" />}
        <span className="year-total">{formatMoney(yearTotal, 'SGD')} this year</span>
      </div>
      <h2>Months</h2>
      <div className="months">
        {months.map(({ m, minor }) => {
          const body = <><span className="month-name">{monthShort(m)}</span><span className="month-amt">{formatMoney(minor, 'SGD')}</span></>;
          const cls = `month-tile${m === cur ? ' current' : ''}`;
          return minor > 0
            ? <Link key={m} to={`/spending/${m}`} className={cls}>{body}</Link>
            : <div key={m} className={`${cls} empty`} aria-disabled="true">{body}</div>;
        })}
      </div>
      {noDate > 0 && (
        <p className="hint">No date: {formatMoney(noDate, 'SGD')} · <Link to="/orders">See orders</Link></p>
      )}

      {filterArtistId === null && (
        <>
          <h2>By artist</h2>
          <Bars items={s.byArtist} colorOf={(name) => {
            const id = idByName.get(name);
            return id ? artistColor(id).ink : undefined;
          }} />
        </>
      )}
      <p style={{ marginTop: 24 }}>
        <Link to="/orders">All orders</Link>{' · '}
        <button onClick={() => downloadText('sticker-collection.csv', collectionCsv(d))}>Export CSV</button>
      </p>
    </main>
  );
}