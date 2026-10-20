import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './data/supabaseClient';
import { MemoryPhotoStore, MemoryRepo } from './data/memoryRepo';
import { SupabasePhotoStore, SupabaseRepo } from './data/supabaseRepo';
import { DataProvider } from './ui/DataProvider';
import { Shell } from './ui/Shell';
import { Login } from './ui/Login';
import { SharedView } from './ui/pages/SharedView';

export function App() {
  const { pathname } = useLocation();
  const shared = pathname.match(/^\/s\/([^/]+)$/);
  if (shared) return <SharedView token={shared[1]} client={supabase} />;
  if (!supabase) return <DemoApp />;
  return <SignedInApp client={supabase} />;
}

function DemoApp() {
  const stores = useMemo(() => ({ repo: new MemoryRepo(), photos: new MemoryPhotoStore() }), []);
  return (
    <DataProvider repo={stores.repo} photos={stores.photos}>
      <Shell demo />
    </DataProvider>
  );
}

function SignedInApp({ client }: { client: SupabaseClient }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [client]);

  const userId = session?.user.id ?? '';
  const stores = useMemo(
    () => ({ repo: new SupabaseRepo(client), photos: new SupabasePhotoStore(client, userId) }),
    [client, userId],
  );

  if (session === undefined) return <p className="page">Loading…</p>;
  if (session === null) return <Login client={client} />;
  return (
    <DataProvider key={userId} repo={stores.repo} photos={stores.photos}>
      <Shell demo={false} onSignOut={() => void client.auth.signOut()} />
    </DataProvider>
  );
}
