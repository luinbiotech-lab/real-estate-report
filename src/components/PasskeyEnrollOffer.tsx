import { CheckCircleRounded, FingerprintRounded } from '@mui/icons-material';
import { Alert, Button, Dialog, DialogActions, DialogContent } from '@mui/material';
import { useState } from 'react';
import { remoteAuthGateway } from '../services/authProviderService';
import { passkeyErrorMessage } from '../services/passkeyWebAuthn';

const DISMISS_KEY = 'daon.passkey.enroll-offer.dismissed.v1';

function dismissed(): boolean {
  try { return window.localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

/**
 * Shown once after a password sign-in: "다음부터 얼굴·지문으로 로그인할까요?"
 * Registering is optional and the password keeps working.
 */
export default function PasskeyEnrollOffer({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(() => !dismissed());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const close = (remember: boolean) => {
    if (remember) { try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage may be blocked */ } }
    setOpen(false);
    onClose();
  };

  const enroll = async () => {
    setBusy(true); setError('');
    try {
      await remoteAuthGateway.registerPasskey();
      setDone(true);
      try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage may be blocked */ }
    } catch (reason) {
      setError(passkeyErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return <Dialog open={open} onClose={() => close(false)} maxWidth="xs" fullWidth PaperProps={{ className: 'daon-passkey-dialog' }}>
    <DialogContent>
      <div className="daon-passkey-visual" aria-hidden="true">{done ? <CheckCircleRounded /> : <FingerprintRounded />}</div>
      <h2 className="daon-passkey-title">{done ? '패스키가 만들어졌습니다' : '다음부터 얼굴·지문으로 로그인할까요?'}</h2>
      <p className="daon-passkey-body">{done
        ? '이제 이 기기에서 얼굴, 지문 또는 화면 잠금 PIN으로 로그인할 수 있습니다. 비밀번호 로그인도 그대로 쓸 수 있습니다.'
        : '이 기기에 패스키를 만들면 비밀번호 없이 들어올 수 있습니다. 생체 정보는 기기 안에만 있고 서버에는 공개키만 저장됩니다.'}</p>
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, flexDirection: 'column', alignItems: 'stretch' }}>
      {done
        ? <Button variant="contained" size="large" onClick={() => close(true)}>확인</Button>
        : <>
          <Button variant="contained" size="large" startIcon={<FingerprintRounded />} disabled={busy} onClick={() => void enroll()}>{busy ? '기기 확인 중…' : '패스키 만들기'}</Button>
          <Button size="small" color="inherit" disabled={busy} onClick={() => close(true)} sx={{ ml: '0 !important' }}>나중에</Button>
        </>}
    </DialogActions>
  </Dialog>;
}
