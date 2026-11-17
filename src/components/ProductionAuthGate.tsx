import { FingerprintRounded, LockPersonRounded } from '@mui/icons-material';
import './ProductionAuthGate.css';
import { Alert, Button, CircularProgress, TextField } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { remoteAuthGateway, type AuthSession } from '../services/authProviderService';
import { REMOTE_OPERATIONAL_MODE } from '../services/operationalDataMode';
import { browserSupportsPasskey, PASSKEY_FEATURE_ENABLED, passkeyErrorMessage } from '../services/passkeyWebAuthn';
import PasskeyEnrollOffer from './PasskeyEnrollOffer';

const REMOTE_AUTH_REQUIRED = REMOTE_OPERATIONAL_MODE || import.meta.env.VITE_REQUIRE_REMOTE_AUTH === 'true';

export default function ProductionAuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checking, setChecking] = useState(REMOTE_AUTH_REQUIRED);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [passkeyReady] = useState(() => PASSKEY_FEATURE_ENABLED && browserSupportsPasskey());
  const [offerEnroll, setOfferEnroll] = useState(false);

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
      if (passkeyReady) setOfferEnroll(true);
    } catch (reason) {
      setSession(null);
      setError(reason instanceof Error ? reason.message : 'Production 로그인에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const signInPasskey = async () => {
    setBusy(true); setError('');
    try {
      setSession(await remoteAuthGateway.signInWithPasskey());
    } catch (reason) {
      setSession(null);
      setError(passkeyErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  if (checking) return <main className="daon-auth-screen daon-auth-loading"><CircularProgress /></main>;
  if (session) return <>{offerEnroll && <PasskeyEnrollOffer onClose={() => setOfferEnroll(false)} />}{children}</>;

  return <main className="daon-auth-screen">
    <section className="daon-auth-card">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}><LockPersonRounded color="primary" /><div><p className="eyebrow" style={{ margin: 0 }}>DA:ON PRODUCTION ACCESS</p><h1 style={{ margin: '4px 0 0', fontSize: 24 }}>운영자 로그인</h1></div></div>
      <p style={{ color: '#667085', lineHeight: 1.6 }}>Production 운영 화면은 Supabase Auth의 active profile을 가진 사용자만 접근할 수 있습니다.</p>
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {passkeyReady && <div className="daon-passkey-block">
        <Button className="daon-passkey-button" variant="contained" size="large" fullWidth startIcon={<FingerprintRounded />} disabled={busy} onClick={() => void signInPasskey()}>{busy ? '확인 중…' : '얼굴·지문으로 로그인'}</Button>
        <p className="daon-passkey-hint">이 기기에 등록한 패스키로 바로 들어갑니다. 생체 정보는 기기 밖으로 나가지 않습니다.</p>
        <div className="daon-auth-divider"><span>또는 이메일로 로그인</span></div>
      </div>}
      <div style={{ display: 'grid', gap: 10 }}>
        <TextField size="small" label="이메일" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextField size="small" label="비밀번호" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && email && password && !busy) void signIn(); }} />
        <Button variant={passkeyReady ? 'outlined' : 'contained'} size="large" disabled={busy || !email || !password} onClick={() => void signIn()}>{busy ? '로그인 확인 중…' : 'Production 로그인'}</Button>
      </div>
      <Alert severity="info" sx={{ mt: 1.5 }}>비밀번호는 저장하지 않습니다. Auth token은 이 탭의 sessionStorage에만 보관되어 새로고침 후 세션을 복원하며, 탭/브라우저 세션 종료 후에는 다시 로그인합니다.</Alert>
    </section>
  </main>;
}
