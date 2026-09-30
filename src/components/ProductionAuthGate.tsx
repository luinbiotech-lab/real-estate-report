import { LockPersonRounded } from '@mui/icons-material';
import { Alert, Button, CircularProgress, TextField } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { remoteAuthGateway, type AuthSession } from '../services/authProviderService';

const REMOTE_AUTH_REQUIRED = import.meta.env.VITE_REQUIRE_REMOTE_AUTH === 'true';

function readRecoveryState() {
  if (typeof window === 'undefined') return { accessToken: '', error: '' };
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  const errorDescription = params.get('error_description') || params.get('error');
  if (errorDescription) return { accessToken: '', error: `비밀번호 재설정 링크 오류: ${errorDescription}` };
  const accessToken = params.get('type') === 'recovery' ? params.get('access_token') ?? '' : '';
  return { accessToken, error: '' };
}

function recoveryRedirectUrl() {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/`;
}

export default function ProductionAuthGate({ children }: { children: ReactNode }) {
  const initialRecovery = readRecoveryState();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checking, setChecking] = useState(REMOTE_AUTH_REQUIRED);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryToken, setRecoveryToken] = useState(initialRecovery.accessToken);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialRecovery.error);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!REMOTE_AUTH_REQUIRED) return;
    if (recoveryToken) {
      setChecking(false);
      return;
    }
    void remoteAuthGateway.getSession()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setChecking(false));
  }, [recoveryToken]);

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

  const sendRecoveryEmail = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      await remoteAuthGateway.sendPasswordRecoveryEmail(email, recoveryRedirectUrl());
      setNotice('비밀번호 재설정 이메일을 보냈습니다. 새로 받은 링크를 열어 새 비밀번호를 저장하세요.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '비밀번호 재설정 이메일 발송에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const updatePassword = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      if (newPassword !== newPasswordConfirm) throw new Error('새 비밀번호 확인이 일치하지 않습니다.');
      await remoteAuthGateway.updatePasswordWithRecoveryToken(recoveryToken, newPassword);
      setNewPassword('');
      setNewPasswordConfirm('');
      setRecoveryToken('');
      if (typeof window !== 'undefined') window.history.replaceState(null, '', `${window.location.origin}/`);
      setNotice('비밀번호를 새로 저장했습니다. 이제 새 비밀번호로 로그인하세요.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '비밀번호 저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (recoveryToken) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f3f5f8' }}>
    <section style={{ width: 'min(460px,100%)', background: '#fff', border: '1px solid #d9e0e8', borderRadius: 16, padding: 24, boxShadow: '0 18px 50px rgba(16,36,63,.08)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}><LockPersonRounded color="primary" /><div><p className="eyebrow" style={{ margin: 0 }}>DA:ON PASSWORD RESET</p><h1 style={{ margin: '4px 0 0', fontSize: 24 }}>새 비밀번호 설정</h1></div></div>
      <p style={{ color: '#667085', lineHeight: 1.6 }}>복구 링크가 확인되었습니다. 새 비밀번호를 저장한 뒤 로그인 화면에서 다시 접속하세요.</p>
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      <div style={{ display: 'grid', gap: 10 }}>
        <TextField size="small" label="새 비밀번호" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        <TextField size="small" label="새 비밀번호 확인" type="password" autoComplete="new-password" value={newPasswordConfirm} onChange={(event) => setNewPasswordConfirm(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && newPassword && newPasswordConfirm && !busy) void updatePassword(); }} />
        <Button variant="contained" size="large" disabled={busy || !newPassword || !newPasswordConfirm} onClick={() => void updatePassword()}>{busy ? '비밀번호 저장 중…' : '새 비밀번호 저장'}</Button>
      </div>
      <Alert severity="info" sx={{ mt: 1.5 }}>복구 링크가 만료되었다면 로그인 화면에서 재설정 이메일을 다시 보내세요.</Alert>
    </section>
  </main>;

  if (checking) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></main>;
  if (session) return <>{children}</>;

  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f3f5f8' }}>
    <section style={{ width: 'min(460px,100%)', background: '#fff', border: '1px solid #d9e0e8', borderRadius: 16, padding: 24, boxShadow: '0 18px 50px rgba(16,36,63,.08)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}><LockPersonRounded color="primary" /><div><p className="eyebrow" style={{ margin: 0 }}>DA:ON PRODUCTION ACCESS</p><h1 style={{ margin: '4px 0 0', fontSize: 24 }}>운영자 로그인</h1></div></div>
      <p style={{ color: '#667085', lineHeight: 1.6 }}>Production 운영 화면은 Supabase Auth의 active profile을 가진 사용자만 접근할 수 있습니다.</p>
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 1.5 }}>{notice}</Alert>}
      <div style={{ display: 'grid', gap: 10 }}>
        <TextField size="small" label="이메일" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextField size="small" label="비밀번호" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && email && password && !busy) void signIn(); }} />
        <Button variant="contained" size="large" disabled={busy || !email || !password} onClick={() => void signIn()}>{busy ? '로그인 확인 중…' : 'Production 로그인'}</Button>
        <Button variant="text" disabled={busy || !email} onClick={() => void sendRecoveryEmail()}>비밀번호 재설정 이메일 보내기</Button>
      </div>
      <Alert severity="info" sx={{ mt: 1.5 }}>비밀번호와 access token은 영구 저장하지 않습니다. 현재 세션은 memory-only 정책을 사용합니다.</Alert>
    </section>
  </main>;
}
