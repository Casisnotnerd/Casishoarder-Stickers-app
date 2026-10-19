import { useState } from 'react';
import { supabase } from '../data/supabaseClient';

export function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [msg, setMsg] = useState<string | null>(null);

  const send = async () => {
    if (!supabase) return;
    setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) setMsg(error.message);
    else setStep('code');
  };

  const verify = async () => {
    if (!supabase) return;
    setMsg(null);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) setMsg(error.message);
    else onDone();
  };

  return (
    <main className="page">
      <h1>Sticker Vault</h1>
      {step === 'email' ? (
        <>
          <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button className="primary" onClick={() => void send()}>Send code</button>
        </>
      ) : (
        <>
          <label>6-digit code<input value={code} onChange={(e) => setCode(e.target.value)} /></label>
          <button className="primary" onClick={() => void verify()}>Verify</button>
        </>
      )}
      {msg && <p className="error">{msg}</p>}
    </main>
  );
}