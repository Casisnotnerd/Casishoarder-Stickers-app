import type { ReactNode } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { useData } from './DataProvider';
import { Collection } from './pages/Collection';
import { AddOrder } from './pages/AddOrder';
import { SheetDetail } from './pages/SheetDetail';
import { Spending } from './pages/Spending';
import { Orders } from './pages/Orders';
import { Settings } from './pages/Settings';

const icon = {
  shelf: <path d="M4 5h4v14H4zM10 5h4v14h-4zM16.5 5.5l3.5 1-3.5 12.9-3.5-1z" />,
  add: <path d="M12 5v14M5 12h14" />,
  spend: <path d="M4 19V10M10 19V5M16 19v-6M3 19h18" />,
  gear: <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v2M12 19v2M4.2 7l1.7 1M18.1 16l1.7 1M4.2 17l1.7-1M18.1 8l1.7-1" />,
};
const Icon = ({ d }: { d: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

export function Shell({ demo, onSignOut }: { demo: boolean; onSignOut?: () => void }) {
  const { loading, error } = useData();
  return (
    <div className="app">
      {demo && <div className="banner">Demo mode: nothing is saved. Add Supabase keys to go live.</div>}
      {error && <div className="banner error">Couldn't load your collection: {error}</div>}
      {loading ? (
        <p className="page">Loading…</p>
      ) : (
        <Routes>
          <Route path="/" element={<Collection />} />
          <Route path="/add" element={<AddOrder />} />
          <Route path="/sheet/:id" element={<SheetDetail />} />
          <Route path="/spending" element={<Spending />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/settings" element={<Settings onSignOut={onSignOut} />} />
          <Route path="*" element={<Collection />} />
        </Routes>
      )}
      <nav className="tabs" aria-label="Main">
        <NavLink to="/" end><Icon d={icon.shelf} />Collection</NavLink>
        <NavLink to="/add" className={({ isActive }) => `add${isActive ? ' active' : ''}`}><Icon d={icon.add} />Add</NavLink>
        <NavLink to="/spending"><Icon d={icon.spend} />Spending</NavLink>
        <NavLink to="/settings"><Icon d={icon.gear} />Settings</NavLink>
      </nav>
    </div>
  );
}
