import { Link, Outlet, useLocation } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Collection' },
  { to: '/add', label: 'Add' },
  { to: '/spending', label: 'Spending' },
  { to: '/orders', label: 'Orders' },
  { to: '/settings', label: 'Settings' },
];

export function Shell() {
  const loc = useLocation();
  return (
    <>
      <Outlet />
      <nav className="tabs">
        {tabs.map((t) => (
          <Link key={t.to} to={t.to} className={loc.pathname === t.to ? 'active' : ''}>{t.label}</Link>
        ))}
      </nav>
    </>
  );
}