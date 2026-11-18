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
      setError(reason instanceof Error ? reason.message : '로그인에 실패했습니다.');
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

  // 2026-11-18 redesign (루치오: "디자인이 최우선"): brand panel + one clear primary action, plain Korean,
  // no developer terms on the first screen. Same gate, same session rules (sessionStorage, password never stored).
  return <main className="daon-auth-screen">
    <aside className="daon-auth-brand" aria-hidden="true">
      <div className="daon-auth-brand-mark">D</div>
      <p className="daon-auth-brand-name">DA:ON ASSET</p>
      <h2 className="daon-auth-brand-title">근거로 확인하고,<br />등급으로 보여 줍니다.</h2>
      <ul className="daon-auth-brand-points">
        <li>값마다 공적서류 근거</li>
        <li>신뢰 등급 A~D</li>
        <li>1P·7P 전문 보고서</li>
      </ul>
    </aside>
    <section className="daon-auth-card" aria-labelledby="daon-auth-title">
      <div className="daon-auth-head">
        <div className="daon-auth-mark" aria-hidden="true"><LockPersonRounded /></div>
        <h1 id="daon-auth-title" className="daon-auth-title">운영자 로그인</h1>
        <p className="daon-auth-sub">등록된 중개사·운영자 계정으로 들어갑니다.</p>
      </div>
      {error && <Alert severity="error" sx={{ mb: 1.5, borderRadius: '12px' }}>{error}</Alert>}
      {passkeyReady && <div className="daon-passkey-block">
        <Button className="daon-passkey-button" variant="contained" size="large" fullWidth startIcon={<FingerprintRounded />} disabled={busy} onClick={() => void signInPasskey()}>{busy ? '확인 중…' : '얼굴·지문으로 로그인'}</Button>
        <div className="daon-auth-divider"><span>또는 이메일로 로그인</span></div>
      </div>}
      <div className="daon-auth-fields">
        <TextField label="이메일" type="email" autoComplete="username webauthn" value={email} onChange={(event) => setEmail(event.target.value)} fullWidth />
        <TextField label="비밀번호" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && email && password && !busy) void signIn(); }} fullWidth />
        <Button className={passkeyReady ? 'daon-auth-secondary' : 'daon-auth-primary'} variant={passkeyReady ? 'outlined' : 'contained'} size="large" disabled={busy || !email || !password} onClick={() => void signIn()}>{busy ? '로그인 확인 중…' : '로그인'}</Button>
      </div>
      <p className="daon-auth-foot">비밀번호는 저장하지 않습니다. 새로고침해도 로그인이 유지되고, 탭을 닫으면 자동으로 로그아웃됩니다.</p>
    </section>
  </main>;
}
