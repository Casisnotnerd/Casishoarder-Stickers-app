import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ChartColumn, Layers, Plus, Search, Settings as SettingsIcon } from 'lucide-react';
import { useData } from './DataProvider';
import { Collection } from './pages/Collection';
import { Home } from './pages/Home';
import { ArtistPage } from './pages/ArtistPage';
import { AddOrder } from './pages/AddOrder';
import { BulkAdd } from './pages/BulkAdd';
import { AddChoice } from './pages/AddChoice';
import { SheetDetail } from './pages/SheetDetail';
import { Spending } from './pages/Spending';
import { Orders } from './pages/Orders';
import { Settings } from './pages/Settings';

const ICON = { size: 21, strokeWidth: 1.75, 'aria-hidden': true } as const;

export function Shell({ demo, onSignOut }: { demo: boolean; onSignOut?: () => void }) {
  const { loading, error } = useData();
  const loc = useLocation();
  return (
    <div className="app">
      {demo && <div className="banner">Demo mode: nothing is saved. Add Supabase keys to go live.</div>}
      {error && <div className="banner error">Couldn't load your collection: {error}</div>}
      {loading ? (
        <p className="page">Loading…</p>
      ) : (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/artist/:id" element={<ArtistPage />} />
          <Route path="/search" element={<Collection searchMode />} />
          <Route path="/add" element={<AddChoice />} />
          <Route path="/add/one" element={<AddOrder />} />
          <Route path="/add/many" element={<BulkAdd />} />
          <Route path="/bulk" element={<BulkRedirect />} />
          <Route path="/sheet/:id" element={<SheetDetail />} />
          <Route path="/spending" element={<Spending />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/settings" element={<Settings onSignOut={onSignOut} />} />
          <Route path="*" element={<Home />} />
        </Routes>
      )}
      <nav className="tabs" aria-label="Main">
        <NavLink to="/" className={({ isActive }) => (isActive || loc.pathname.startsWith('/artist/') ? 'active' : '')} end><Layers {...ICON} />Collection</NavLink>
        <NavLink to="/search"><Search {...ICON} />Search</NavLink>
        <NavLink to="/add" aria-label="Add" className={({ isActive }) => `add${isActive ? ' active' : ''}`}><Plus size={25} strokeWidth={1.75} aria-hidden /></NavLink>
        <NavLink to="/spending"><ChartColumn {...ICON} />Spending</NavLink>
        <NavLink to="/settings"><SettingsIcon {...ICON} />Settings</NavLink>
      </nav>
    </div>
  );
}

function BulkRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/add/many${search}`} replace />;
}
