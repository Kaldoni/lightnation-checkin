import { useEffect, useState } from 'react';
import { request, setAccessToken } from './api';

export default function TeacherLogin({ children }) {
  const [teacher, setTeacher] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const expired = () => { setTeacher(null); setPassword(''); setError('Your session expired. Please sign in again.'); };
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, []);
  async function login(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const session = await request('/auth/login', { method: 'POST', body: { email, password } });
      setAccessToken(session.accessToken); setTeacher(session.email); setPassword('');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  if (teacher) return <>
    <div style={{ padding: '10px 20px', background: '#1A2744', color: 'white', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', fontFamily: 'sans-serif' }}>
      <span>{teacher}</span>
      <button onClick={() => { setAccessToken(''); setTeacher(null); setError(''); }} style={{ padding: '8px 16px', cursor: 'pointer' }}>Sign out</button>
    </div>
    {children}
  </>;
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#FDF6EC', padding: 20, fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
    <form onSubmit={login} style={{ width: '100%', maxWidth: 380, background: '#fff', padding: 28, borderRadius: 20, boxSizing: 'border-box', boxShadow: '0 8px 30px #0001' }}>
      <h1 style={{ color: '#1A2744', marginTop: 0 }}>LightNation</h1>
      <h2 style={{ fontSize: 20 }}>Teacher sign in</h2>
      <p style={{ color: '#666', lineHeight: 1.5 }}>Sign in to register children and manage attendance.</p>
      <label htmlFor="teacher-email">Email</label>
      <input id="teacher-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
      <label htmlFor="teacher-password">Password</label>
      <input id="teacher-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
      {error && <p role="alert" style={{ color: '#a12b36' }}>{error}</p>}
      <button disabled={busy} type="submit" style={{ width: '100%', padding: 12, border: 0, borderRadius: 10, background: '#1A2744', color: '#fff', cursor: 'pointer', fontSize: 16 }}>{busy ? 'Signing in...' : 'Sign in'}</button>
    </form>
  </main>;
}
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: 12, margin: '8px 0 18px', border: '1px solid #c9c9c9', borderRadius: 8, fontSize: 16 };
