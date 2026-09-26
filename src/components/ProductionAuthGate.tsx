import { LockPersonRounded } from '@mui/icons-material';
import { Alert, Button, CircularProgress, TextField } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { remoteAuthGateway, type AuthSession } from '../services/authProviderService';

const REMOTE_AUTH_REQUIRED = import.meta.env.VITE_REQUIRE_REMOTE_AUTH === 'true';

export default function ProductionAuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checking, setChecking] = useState(REMOTE_AUTH_REQUIRED);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!REMOTE_AUTH_REQUIRED) return;
    void remoteAuthGateway.getSession()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setChecking(false));
  }, []);

  if (!REMOTE_AUTH_REQUIRED) return <>{children}</>;

  const signIn = async () => {
    setBusy(true); setError('');
    try {
      const next = await remoteAuthGateway.signIn(email, password);
      setSession(next);
      setPassword('');
    } catch (reason) {
      setSession(null);
      setError(reason instanceof Error ? reason.message : 'Production 로그인에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (checking) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></main>;
  if (session) return <>{children}</>;

  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f3f5f8' }}>
    <section style={{ width: 'min(460px,100%)', background: '#fff', border: '1px solid #d9e0e8', borderRadius: 16, padding: 24, boxShadow: '0 18px 50px rgba(16,36,63,.08)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}><LockPersonRounded color="primary" /><div><p className="eyebrow" style={{ margin: 0 }}>DA:ON PRODUCTION ACCESS</p><h1 style={{ margin: '4px 0 0', fontSize: 24 }}>운영자 로그인</h1></div></div>
      <p style={{ color: '#667085', lineHeight: 1.6 }}>Production 운영 화면은 Supabase Auth의 active profile을 가진 사용자만 접근할 수 있습니다.</p>
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      <div style={{ display: 'grid', gap: 10 }}>
        <TextField size="small" label="이메일" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextField size="small" label="비밀번호" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && email && password && !busy) void signIn(); }} />
        <Button variant="contained" size="large" disabled={busy || !email || !password} onClick={() => void signIn()}>{busy ? '로그인 확인 중…' : 'Production 로그인'}</Button>
      </div>
      <Alert severity="info" sx={{ mt: 1.5 }}>비밀번호와 access token은 영구 저장하지 않습니다. 현재 세션은 memory-only 정책을 사용합니다.</Alert>
    </section>
  </main>;
}
