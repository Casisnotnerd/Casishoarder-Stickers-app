import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export function Login({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const send = async () => {
    setMsg(null);
    const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
    if (error) setMsg(error.message);
    else setSent(true);
  };

  const verify = async () => {
    setMsg(null);
    const { error } = await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    if (error) setMsg(error.message);
  };

  return (
    <main className="page narrow">
      <h1>Sticker Shelf</h1>
      {!sent ? (
        <>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <button className="primary" onClick={send} disabled={!email.includes('@')}>Send me a code</button>
        </>
      ) : (
        <>
          <p>We emailed a 6-digit code to {email}.</p>
          <label>Code<input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" /></label>
          <button className="primary" onClick={verify} disabled={code.trim().length < 6}>Sign in</button>
          <button onClick={() => setSent(false)}>Use a different email</button>
        </>
      )}
      {msg && <p className="error">{msg}</p>}
    </main>
  );
}
