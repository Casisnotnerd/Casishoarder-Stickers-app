import type { CSSProperties } from 'react';
import type { Bucket } from '../domain/spending';
import { formatMoney } from '../domain/currency';

export function Bars({ items, colorOf }: { items: Bucket[]; colorOf?: (label: string) => string | undefined }) {
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
