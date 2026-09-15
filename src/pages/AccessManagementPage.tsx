import { AdminPanelSettingsRounded, LockPersonRounded, PersonAddAltRounded, ShieldRounded } from '@mui/icons-material';
import { Alert, Button, Chip, MenuItem, TextField } from '@mui/material';
import { useMemo, useState } from 'react';
import {
  ACCESS_STORAGE_KEY,
  CAPABILITY_LABELS,
  ROLE_CAPABILITIES,
  ROLE_LABELS,
  accessControlService,
  type AccessProfile,
  type AccessRole,
} from '../services/accessControlService';
import { AUTH_PROVIDER_SUMMARIES } from '../services/authProviderService';

const ROLES: AccessRole[] = ['owner', 'admin', 'editor', 'viewer'];
const AUTH_CAPABILITY_LABELS = [
  ['authenticatedSession', '인증 세션'],
  ['userInvitation', '사용자 초대'],
  ['persistentProfile', '서버 프로필'],
  ['rlsEnforcement', 'RLS 강제'],
  ['ownerOnlyAdministration', 'OWNER 전용 관리'],
  ['multiDevicePersistence', '멀티디바이스 동기화'],
] as const;

export default function AccessManagementPage() {
  const [profiles, setProfiles] = useState<AccessProfile[]>(() => accessControlService.listProfiles());
  const [displayName, setDisplayName] = useState('');
  const [newRole, setNewRole] = useState<AccessRole>('viewer');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const activeCount = useMemo(() => profiles.filter((item) => item.status === 'active').length, [profiles]);
  const ownerCount = useMemo(() => profiles.filter((item) => item.role === 'owner' && item.status === 'active').length, [profiles]);

  const addProfile = () => {
    setError(''); setNotice('');
    try {
      setProfiles(accessControlService.addProfile(displayName, newRole));
      setDisplayName('');
      setNewRole('viewer');
      setNotice('로컬 권한 프로필을 추가했습니다. 실제 로그인 계정은 Auth 연결 후 생성됩니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '권한 프로필을 추가하지 못했습니다.');
    }
  };

  const changeRole = (id: string, role: AccessRole) => {
    setError(''); setNotice('');
    try {
      setProfiles(accessControlService.updateRole(id, role));
      setNotice('역할 정책을 변경했습니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '역할을 변경하지 못했습니다.');
    }
  };

  const toggleStatus = (profile: AccessProfile) => {
    setError(''); setNotice('');
    try {
      setProfiles(accessControlService.setStatus(profile.id, profile.status === 'active' ? 'inactive' : 'active'));
      setNotice('사용자 정책 상태를 변경했습니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '상태를 변경하지 못했습니다.');
    }
  };

  return <main style={{ padding: 28, maxWidth: 1380, margin: '0 auto' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20 }}>
      <div>
        <p className="eyebrow">USER · ROLE · ACCESS POLICY</p>
        <h1 style={{ margin: '5px 0' }}>사용자 · 권한 관리</h1>
        <p style={{ margin: 0, color: '#667085' }}>인증 서버 연결 전 권한정책을 먼저 고정합니다. Auth/RLS 연결 후 동일 역할표를 서버 권한으로 승격합니다.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Chip color="success" icon={<ShieldRounded />} label="LOCAL POLICY READY" />
        <Chip color="warning" icon={<LockPersonRounded />} label="AUTH NOT CONNECTED" />
      </div>
    </header>

    {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setNotice('')}>{notice}</Alert>}
    <Alert severity="info" sx={{ mb: 1.5 }}>현재 프로필은 `{ACCESS_STORAGE_KEY}`에 저장되는 로컬 권한정책입니다. 이메일 초대, 비밀번호, 로그인 세션, 서버 RLS는 아직 연결하지 않았습니다.</Alert>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(320px,1fr))', gap: 12, marginBottom: 16 }}>
      {AUTH_PROVIDER_SUMMARIES.map((provider) => <div key={provider.kind} style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
          <div><small style={{ color: '#667085', letterSpacing: '.08em' }}>AUTH PROVIDER</small><strong style={{ display: 'block', marginTop: 4 }}>{provider.label}</strong></div>
          <Chip size="small" color={provider.status === 'ready' ? 'success' : 'warning'} label={provider.status === 'ready' ? 'READY' : 'NOT CONFIGURED'} />
        </div>
        <p style={{ color: '#667085', fontSize: 12, lineHeight: 1.55 }}>{provider.description}</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {AUTH_CAPABILITY_LABELS.map(([key, label]) => <Chip key={key} size="small" variant="outlined" color={provider.status === 'ready' && provider.capabilities[key] ? 'success' : 'default'} label={`${label} ${provider.capabilities[key] ? '✓' : '—'}`} />)}
        </div>
      </div>)}
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(160px,1fr))', gap: 10, marginBottom: 16 }}>
      {[
        ['등록 프로필', profiles.length], ['ACTIVE', activeCount], ['ACTIVE OWNER', ownerCount],
      ].map(([label, value]) => <div key={String(label)} style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 14 }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', fontSize: 28, marginTop: 4 }}>{value}</strong></div>)}
    </section>

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div><strong style={{ fontSize: 16 }}>ROLE MATRIX</strong><p style={{ margin: '4px 0 0', color: '#667085', fontSize: 12 }}>역할별 허용 capability를 명시적으로 고정합니다.</p></div>
        <AdminPanelSettingsRounded color="primary" />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
          <thead><tr><th style={{ textAlign: 'left', padding: 9, borderBottom: '1px solid #e4e9ef' }}>CAPABILITY</th>{ROLES.map((role) => <th key={role} style={{ textAlign: 'center', padding: 9, borderBottom: '1px solid #e4e9ef' }}>{ROLE_LABELS[role]}</th>)}</tr></thead>
          <tbody>{Object.entries(CAPABILITY_LABELS).map(([capability, label]) => <tr key={capability}><td style={{ padding: 9, borderBottom: '1px solid #f0f2f5', fontSize: 13 }}>{label}</td>{ROLES.map((role) => <td key={role} style={{ textAlign: 'center', padding: 9, borderBottom: '1px solid #f0f2f5' }}><Chip size="small" color={ROLE_CAPABILITIES[role].includes(capability as never) ? 'success' : 'default'} variant="outlined" label={ROLE_CAPABILITIES[role].includes(capability as never) ? 'ALLOW' : '—'} /></td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,.8fr) minmax(520px,1.4fr)', gap: 14 }}>
      <div style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 16 }}>
        <strong>로컬 권한 프로필 추가</strong>
        <p style={{ color: '#667085', fontSize: 12 }}>실제 계정 초대가 아니라 Auth 연결 전 역할정책 테스트용 프로필입니다.</p>
        <div style={{ display: 'grid', gap: 10 }}>
          <TextField size="small" label="표시명" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="예: 자산관리 담당" />
          <TextField select size="small" label="역할" value={newRole} onChange={(event) => setNewRole(event.target.value as AccessRole)}>{ROLES.map((role) => <MenuItem key={role} value={role}>{ROLE_LABELS[role]}</MenuItem>)}</TextField>
          <Button variant="contained" startIcon={<PersonAddAltRounded />} onClick={addProfile}>로컬 프로필 추가</Button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 16 }}>
        <strong>ACCESS PROFILES</strong>
        <p style={{ color: '#667085', fontSize: 12 }}>OWNER 정책은 최소 1개 ACTIVE 상태를 유지합니다.</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {profiles.map((profile) => <div key={profile.id} style={{ border: '1px solid #e7ebf0', borderRadius: 10, padding: 11, display: 'grid', gridTemplateColumns: '1fr 150px 110px', gap: 8, alignItems: 'center' }}>
            <div><strong style={{ display: 'block', fontSize: 13 }}>{profile.displayName}</strong><small style={{ color: '#667085' }}>{profile.source} · {profile.id}</small></div>
            <TextField select size="small" value={profile.role} disabled={profile.id === 'local-owner'} onChange={(event) => changeRole(profile.id, event.target.value as AccessRole)}>{ROLES.map((role) => <MenuItem key={role} value={role}>{ROLE_LABELS[role]}</MenuItem>)}</TextField>
            <Button size="small" color={profile.status === 'active' ? 'warning' : 'success'} disabled={profile.id === 'local-owner'} onClick={() => toggleStatus(profile)}>{profile.status === 'active' ? '비활성화' : '활성화'}</Button>
          </div>)}
        </div>
      </div>
    </section>

    <Alert severity="warning" sx={{ mt: 1.5 }}>이 화면은 권한정책 관리 단계입니다. 실제 보안 경계는 부동산 전용 Auth + 서버 RLS 연결 후 강제됩니다. 현재 브라우저 로컬 프로필만으로 민감 데이터 접근을 보호한다고 간주하면 안 됩니다.</Alert>
  </main>;
}
