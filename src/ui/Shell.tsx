import { Link, Outlet, useLocation } from 'react-router-dom';
import { useData } from './DataProvider';

const tabs = [
  { to: '/', label: 'Collection' },
  { to: '/add', label: 'Add' },
  { to: '/spending', label: 'Spending' },
  { to: '/orders', label: 'Orders' },
  { to: '/settings', label: 'Settings' },
];

export function Shell() {
  const loc = useLocation();
  const d = useData();
  return (
    <>
      {d.error && <div style={{ background: '#f8d7da', color: '#721c24', padding: '0.5rem 1rem' }}>Error: {d.error}</div>}
      <Outlet />
      <nav className="tabs">
        {tabs.map((t) => (
          <Link key={t.to} to={t.to} className={loc.pathname === t.to ? 'active' : ''}>{t.label}</Link>
        ))}
      </nav>
    </>
  );
}