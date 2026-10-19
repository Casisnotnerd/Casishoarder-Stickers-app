import { useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { supabase } from './data/supabaseClient';
import { DataProvider } from './ui/DataProvider';
import { Shell } from './ui/Shell';
import { Login } from './ui/Login';
import { Collection } from './ui/pages/Collection';
import { AddOrder } from './ui/pages/AddOrder';
import { SheetDetail } from './ui/pages/SheetDetail';
import { Spending } from './ui/pages/Spending';
import { Orders } from './ui/pages/Orders';
import { Settings } from './ui/pages/Settings';
import { SharedView } from './ui/pages/SharedView';

export function App() {
  const [session, setSession] = useState<any>(null);
  const [ready, setReady] = useState(!supabase);
  const loc = useLocation();

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }: { data: any }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e: any, s: any) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Shared view route: /s/:token
  const m = loc.pathname.match(/^\/s\/(.+)$/);
  if (m) {
    return <SharedView token={m[1]} client={supabase} />;
  }

  if (!ready) return <p>Loading...</p>;

  if (supabase && !session) {
    return <Login onDone={() => supabase!.auth.getSession().then(({ data }: { data: any }) => setSession(data.session))} />;
  }

  return (
    <DataProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<Collection />} />
          <Route path="/add" element={<AddOrder />} />
          <Route path="/sheet/:id" element={<SheetDetail />} />
          <Route path="/spending" element={<Spending />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/settings" element={<Settings onSignOut={() => supabase?.auth.signOut()} />} />
        </Route>
      </Routes>
    </DataProvider>
  );
}