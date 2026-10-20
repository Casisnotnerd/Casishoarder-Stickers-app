import type { OrderForm } from '../domain/orderForm';
import { COMMON_CURRENCIES } from '../domain/currency';

export function OrderFields({ value, onChange }: { value: OrderForm; onChange: (f: OrderForm) => void }) {
  const set = (patch: Partial<OrderForm>) => onChange({ ...value, ...patch });
  const foreign = value.currency !== 'SGD';
  return (
    <div className="card">
      <div className="row">
        <label>Date<input type="date" value={value.date} onChange={(e) => set({ date: e.target.value })} /></label>
        <label>Shop<input value={value.shop} onChange={(e) => set({ shop: e.target.value })} /></label>
      </div>
      <div className="row">
        <label>Currency
          <select value={value.currency} onChange={(e) => set({ currency: e.target.value })}>
            {COMMON_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>Shipping / fees ({value.currency})<input inputMode="decimal" value={value.shipping} onChange={(e) => set({ shipping: e.target.value })} /></label>
        <label>Order total ({value.currency})<input inputMode="decimal" value={value.total} onChange={(e) => set({ total: e.target.value })} /></label>
      </div>
      {foreign && (
        <label>SGD actually paid (from your bank / card)
          <input inputMode="decimal" placeholder="e.g. 15.60" value={value.sgdPaid} onChange={(e) => set({ sgdPaid: e.target.value })} />
        </label>
      )}
      <label>
        <input type="checkbox" checked={value.estimated} onChange={(e) => set({ estimated: e.target.checked })} />
        Date / amounts are rough estimates
      </label>
    </div>
  );
}
