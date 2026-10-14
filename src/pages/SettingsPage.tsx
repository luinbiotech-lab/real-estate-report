import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Alert, Button, Chip, TextField } from '@mui/material';
import { BusinessRounded, ContactPhoneRounded, PolicyRounded, SaveRounded, StorageRounded } from '@mui/icons-material';
import { settingsRepository } from '../repositories/propertyRepository';
import type { Settings } from '../types';
import { refreshProxyStatus, type ProxyStatus } from '../services/maps/proxyClient';

function normalizePhone(value: string) {
  return value.replace(/[^0-9]/g, '');
}

export default function SettingsPage({ settings, onSave }: { settings: Settings; onSave: (settings: Settings) => void }) {
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [providerStatus, setProviderStatus] = useState<ProxyStatus>();
  useEffect(() => { void refreshProxyStatus().then(setProviderStatus); }, []);

  const contactReady = useMemo(() => Boolean(draft.defaultManager.trim() && normalizePhone(draft.phone).length >= 9 && draft.email.includes('@')), [draft]);

  const uploadLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('로고는 이미지 파일만 사용할 수 있습니다.'); return; }
    const reader = new FileReader();
    reader.onload = () => setDraft((previous) => ({ ...previous, logo: String(reader.result) }));
    reader.onerror = () => setError('로고 파일을 읽지 못했습니다.');
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setError(''); setNotice('');
    if (!draft.companyName.trim()) { setError('회사명을 입력하세요.'); return; }
    if (!draft.defaultManager.trim()) { setError('기본 담당자 표시명을 입력하세요.'); return; }
    if (normalizePhone(draft.phone).length < 9) { setError('휴대폰 번호를 확인하세요.'); return; }
    if (!draft.email.includes('@')) { setError('이메일 형식을 확인하세요.'); return; }
    const normalized: Settings = { ...draft, reportContactMode: 'mobile_email_only' };
    await settingsRepository.save(normalized);
    onSave(normalized);
    setNotice('회사·브랜드 기본 설정을 저장했습니다. 새 물건부터 기본값으로 적용됩니다.');
  };

  return <main style={{ padding: 28, maxWidth: 1240, margin: '0 auto' }}>
    <header className="page-header" style={{ marginBottom: 18 }}>
      <div><p className="eyebrow">BRAND · CONTACT · REPORT DEFAULTS</p><h1>회사 설정</h1><p>브랜드와 담당자 기본값을 한곳에서 관리합니다. 개별 물건에 이미 저장된 담당자 정보는 자동으로 덮어쓰지 않습니다.</p></div>
      <Button variant="contained" startIcon={<SaveRounded />} onClick={() => void save()}>설정 저장</Button>
    </header>

    {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setNotice('')}>{notice}</Alert>}

    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(320px,.8fr)', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 14 }}>
        <section className="form-section settings-card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div><p className="eyebrow">BRAND IDENTITY</p><h2 style={{ margin: 0 }}>브랜드 기본정보</h2></div><BusinessRounded color="primary" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 18, alignItems: 'start' }}>
            <div className="settings-logo" style={{ minHeight: 150 }}>
              {draft.logo ? <img src={draft.logo} alt="회사 로고 미리보기" /> : <span>DA:ON<br />LOGO</span>}
              <Button component="label" size="small">로고 {draft.logo ? '교체' : '업로드'}<input hidden type="file" accept="image/*" onChange={uploadLogo} /></Button>
              {draft.logo && <Button size="small" color="error" onClick={() => setDraft((previous) => ({ ...previous, logo: '' }))}>삭제</Button>}
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <TextField label="회사명" value={draft.companyName} onChange={(event) => setDraft((previous) => ({ ...previous, companyName: event.target.value }))} />
              <TextField label="브랜드 슬로건" value={draft.brandSlogan} onChange={(event) => setDraft((previous) => ({ ...previous, brandSlogan: event.target.value }))} placeholder="예: PROPERTY DATA & AGENT PLATFORM" />
            </div>
          </div>
        </section>

        <section className="form-section" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div><p className="eyebrow">DEFAULT CONTACT</p><h2 style={{ margin: 0 }}>기본 담당자</h2></div><ContactPhoneRounded color="primary" />
          </div>
          <div className="field-grid">
            <TextField label="기본 담당자 표시명" value={draft.defaultManager} onChange={(event) => setDraft((previous) => ({ ...previous, defaultManager: event.target.value }))} helperText="새 물건 등록 시 기본값으로만 사용합니다." />
            <TextField label="휴대폰" value={draft.phone} onChange={(event) => setDraft((previous) => ({ ...previous, phone: event.target.value }))} />
            <TextField label="이메일" type="email" value={draft.email} onChange={(event) => setDraft((previous) => ({ ...previous, email: event.target.value }))} />
          </div>
        </section>

        <section className="form-section" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div><p className="eyebrow">DATA PROVIDERS</p><h2 style={{ margin: 0 }}>외부 데이터 공급원</h2></div><StorageRounded color="primary" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
            {[
              ['NAVER Maps', providerStatus?.naverConfigured, '주소·정적지도'],
              ['Kakao Local', providerStatus?.kakaoConfigured, '주소·POI·상업활동 evidence'],
              ['국토부 공공데이터', providerStatus?.publicDataConfigured, '건축물대장·실거래·에너지·상가업소'],
              ['VWorld', providerStatus?.vworldConfigured, '공시지가·토지특성·토지이용계획'],
            ].map(([name, ready, scope]) => <div key={String(name)} style={{ border: '1px solid #e4e7ec', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <strong>{String(name)}</strong>
                <Chip size="small" color={ready ? 'success' : 'warning'} label={ready ? 'READY' : 'MISSING'} />
              </div>
              <div style={{ color: '#667085', fontSize: 12, marginTop: 5 }}>{String(scope)}</div>
            </div>)}
          </div>
          {!providerStatus?.publicDataConfigured && <Alert severity="warning" sx={{ mt: 1.25 }}>
            <strong>DATA_GO_KR_SERVICE_KEY가 없습니다.</strong> 주소·좌표·Kakao POI는 동작하지만 건축물대장, 국토부 실거래, 건물에너지, 상가업소 공공자료는 아직 자동조회되지 않습니다.
            <div style={{ marginTop: 6, fontSize: 12 }}>
              활용신청 필요: 국토교통부 건축HUB 건축물대장정보 · 상업업무용 부동산 매매 실거래가 · 토지 매매 실거래가 · 건축HUB 건물에너지정보 · 소상공인시장진흥공단 상가(상권)정보 API
            </div>
          </Alert>}
          {!providerStatus?.vworldConfigured && <Alert severity="info" sx={{ mt: 1.25 }}>
            <strong>VWORLD_API_KEY가 없습니다.</strong> 공시지가·토지특성 자동조회는 키 등록 후 활성화됩니다.
          </Alert>}
          <small style={{ display: 'block', color: '#667085', marginTop: 10 }}>API 비밀키는 브라우저/DB에 저장하지 않고 Vercel 서버 환경변수로만 관리합니다.</small>
        </section>

        <section className="form-section" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div><p className="eyebrow">REPORT POLICY</p><h2 style={{ margin: 0 }}>보고서 기본 정책</h2></div><PolicyRounded color="primary" />
          </div>
          <Alert severity="info" sx={{ mb: 1.5 }}><strong>연락처 표시 정책은 고정입니다.</strong> DAON_1P_MASTER와 DAON_DETAIL_7P_MASTER의 연락처 영역에는 휴대폰과 이메일만 사용합니다. 사무실 전화·팩스·주소 등은 자동 추가하지 않습니다.</Alert>
          <TextField fullWidth multiline minRows={3} label="기본 하단 면책문구" value={draft.footerText} onChange={(event) => setDraft((previous) => ({ ...previous, footerText: event.target.value }))} />
        </section>
      </div>

      <aside style={{ display: 'grid', gap: 14, position: 'sticky', top: 24 }}>
        <section style={{ background: '#10243f', color: '#fff', borderRadius: 14, padding: 18 }}>
          <p style={{ margin: 0, color: '#d7c8a7', letterSpacing: '.12em', fontSize: 11 }}>REPORT CONTACT PREVIEW</p>
          <h2 style={{ margin: '6px 0 16px' }}>보고서 연락처 미리보기</h2>
          <div style={{ borderTop: '1px solid rgba(255,255,255,.18)', paddingTop: 14, display: 'grid', gap: 8 }}>
            <strong>{draft.defaultManager || '담당자 미입력'}</strong>
            <span>{draft.phone || '휴대폰 미입력'}</span>
            <span>{draft.email || '이메일 미입력'}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
            <Chip size="small" label="MOBILE" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.35)' }} variant="outlined" />
            <Chip size="small" label="EMAIL" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.35)' }} variant="outlined" />
            <Chip size="small" color={contactReady ? 'success' : 'warning'} label={contactReady ? 'CONTACT READY' : 'CHECK CONTACT'} />
          </div>
        </section>

        <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 14, padding: 16 }}>
          <p className="eyebrow">APPLY SCOPE</p><h3 style={{ margin: '4px 0 10px' }}>적용 범위</h3>
          <div style={{ display: 'grid', gap: 9, fontSize: 13, color: '#475467' }}>
            <span>✓ 새 물건 등록 기본 담당자</span>
            <span>✓ 보고서/제안서 브랜드 기본값</span>
            <span>✓ 기본 면책문구</span>
            <span>✓ 연락처 정책: 휴대폰 + 이메일</span>
            <span>— 기존 물건 담당자 자동 덮어쓰기 없음</span>
          </div>
        </section>
      </aside>
    </section>
  </main>;
}