import { AdminPanelSettingsRounded, LockPersonRounded, PersonAddAltRounded, ShieldRounded } from '@mui/icons-material';
import { Alert, Button, Chip, MenuItem, TextField } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import {
  ACCESS_STORAGE_KEY,
  CAPABILITY_LABELS,
  ROLE_CAPABILITIES,
  ROLE_LABELS,
  accessControlService,
  type AccessProfile,
  type AccessRole,
} from '../services/accessControlService';
import { AUTH_PROVIDER_SUMMARIES, remoteAuthGateway, type AuthSession } from '../services/authProviderService';
import type { RemoteAuthProfile } from '../services/supabaseRemoteAuthGateway';

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
  const [remoteEmail, setRemoteEmail] = useState('');
  const [remotePassword, setRemotePassword] = useState('');
  const [remoteSession, setRemoteSession] = useState<AuthSession | null>(null);
  const [remoteProfiles, setRemoteProfiles] = useState<RemoteAuthProfile[]>([]);
  const [remoteInviteEmail, setRemoteInviteEmail] = useState('');
  const [remoteInviteName, setRemoteInviteName] = useState('');
  const [remoteInviteRole, setRemoteInviteRole] = useState<AccessRole>('viewer');
  const [ownerBootstrapKey, setOwnerBootstrapKey] = useState('');
  const [remoteBusy, setRemoteBusy] = useState(false);

  useEffect(() => {
    void remoteAuthGateway.getSession().then(async (session) => {
      setRemoteSession(session);
      if (session?.role === 'owner') {
        try { setRemoteProfiles(await remoteAuthGateway.listProfiles()); } catch { setRemoteProfiles([]); }
      }
    }).catch(() => setRemoteSession(null));
  }, []);

  const signInRemote = async () => {
    setError(''); setNotice(''); setRemoteBusy(true);
    try {
      const session = await remoteAuthGateway.signIn(remoteEmail, remotePassword);
      setRemoteSession(session);
      setRemoteProfiles(session.role === 'owner' ? await remoteAuthGateway.listProfiles() : []);
      setRemotePassword('');
      setNotice('REMOTE AUTH 로그인과 서버 profile/RLS 확인이 완료되었습니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'REMOTE AUTH 로그인에 실패했습니다.');
    } finally {
      setRemoteBusy(false);
    }
  };

  const signOutRemote = async () => {
    setError(''); setNotice(''); setRemoteBusy(true);
    try {
      await remoteAuthGateway.signOut();
      setRemoteSession(null);
      setRemoteProfiles([]);
      setOwnerBootstrapKey('');
      setNotice('REMOTE AUTH 세션을 종료했습니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'REMOTE AUTH 로그아웃에 실패했습니다.');
    } finally {
      setRemoteBusy(false);
    }
  };

  const loadRemoteProfiles = async () => {
    if (remoteSession?.role !== 'owner') return;
    setRemoteBusy(true); setError('');
    try {
      setRemoteProfiles(await remoteAuthGateway.listProfiles());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'REMOTE profile을 불러오지 못했습니다.');
    } finally {
      setRemoteBusy(false);
    }
  };

  const bootstrapRemoteOwner = async () => {
    if (!remoteSession || !ownerBootstrapKey) return;
    setRemoteBusy(true); setError(''); setNotice('');
    try {
      const profile = await remoteAuthGateway.bootstrapOwner(ownerBootstrapKey);
      setRemoteSession(profile);
      setOwnerBootstrapKey('');
      setRemoteProfiles(await remoteAuthGateway.listProfiles());
      setNotice('최초 REMOTE OWNER bootstrap이 완료되었습니다. 운영 secret은 즉시 rotate/remove해야 합니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'REMOTE OWNER bootstrap에 실패했습니다.');
    } finally {
      setRemoteBusy(false);
    }
  };

  const inviteRemoteUser = async () => {
    if (remoteSession?.role !== 'owner' || !remoteInviteEmail) return;
    setRemoteBusy(true); setError(''); setNotice('');
    try {
      await remoteAuthGateway.inviteUser(remoteInviteEmail, remoteInviteRole, remoteInviteName);
      setRemoteInviteEmail(''); setRemoteInviteName(''); setRemoteInviteRole('viewer');
      setRemoteProfiles(await remoteAuthGateway.listProfiles());
      setNotice('REMOTE 사용자 초대를 요청했습니다. 서버 profile은 OWNER 정책과 RLS가 최종 강제합니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'REMOTE 사용자 초대에 실패했습니다.');
    } finally {
      setRemoteBusy(false);
    }
  };

  const updateRemoteRole = async (profile: RemoteAuthProfile, role: AccessRole) => {
    if (remoteSession?.role !== 'owner') return;
    setRemoteBusy(true); setError(''); setNotice('');
    try {
      await remoteAuthGateway.updateRole(profile.userId, role);
      setRemoteProfiles(await remoteAuthGateway.listProfiles());
      setNotice('REMOTE role을 변경했습니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'REMOTE role 변경에 실패했습니다.');
    } finally {
      setRemoteBusy(false);
    }
  };

  const toggleRemoteActive = async (profile: RemoteAuthProfile) => {
    if (remoteSession?.role !== 'owner') return;
    setRemoteBusy(true); setError(''); setNotice('');
    try {
      await remoteAuthGateway.setActive(profile.userId, !profile.active);
      setRemoteProfiles(await remoteAuthGateway.listProfiles());
      setNotice('REMOTE 사용자 활성 상태를 변경했습니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'REMOTE 사용자 상태 변경에 실패했습니다.');
    } finally {
      setRemoteBusy(false);
    }
  };

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
        <p style={{ margin: 0, color: '#667085' }}>로컬 역할정책과 production Supabase Auth/RLS를 함께 관리합니다. 실제 원격 권한은 서버 RLS가 최종 강제합니다.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Chip color="success" icon={<ShieldRounded />} label="LOCAL POLICY READY" />
        <Chip color="success" icon={<LockPersonRounded />} label="REMOTE AUTH BACKEND CONNECTED" />
        <Chip color={remoteSession?.role === 'owner' ? 'warning' : 'default'} label={remoteSession?.role === 'owner' ? 'OWNER SESSION · ACCEPTANCE PENDING' : 'REAL OPERATOR OWNER REQUIRED'} />
      </div>
    </header>

    {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setNotice('')}>{notice}</Alert>}
    <Alert severity="info" sx={{ mb: 1.5 }}>로컬 정책 프로필은 `{ACCESS_STORAGE_KEY}`에 별도 유지됩니다. REMOTE AUTH는 production Supabase에 연결됐으며 로그인 후 서버 profile과 RLS가 적용됩니다. 비밀번호와 access token은 이 화면에서 영구 저장하지 않습니다.</Alert>
    <Alert severity="warning" sx={{ mb: 1.5 }}><strong>PRODUCTION SECURITY · MANUAL CHECK REQUIRED</strong> · Supabase Auth의 Leaked Password Protection 활성화 여부는 운영 승인 전에 Dashboard에서 직접 확인해야 합니다. 브라우저 UI는 이 설정을 자동으로 READY 처리하지 않습니다.</Alert>

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

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <strong>REMOTE AUTH SESSION</strong>
          <p style={{ margin: '4px 0 0', color: '#667085', fontSize: 12 }}>Production Supabase 로그인 · memory-only token store</p>
        </div>
        <Chip size="small" color={remoteSession ? 'success' : 'default'} label={remoteSession ? `SIGNED IN · ${remoteSession.role.toUpperCase()}` : 'SIGNED OUT'} />
      </div>
      {remoteSession ? <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span><strong>{remoteSession.displayName || remoteSession.email || remoteSession.userId}</strong></span>
        <span style={{ color: '#667085', fontSize: 12 }}>{remoteSession.email}</span>
        <Button variant="outlined" disabled={remoteBusy} onClick={signOutRemote}>로그아웃</Button>
      </div> : <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) minmax(220px,1fr) auto', gap: 10 }}>
        <TextField size="small" label="이메일" type="email" autoComplete="username" value={remoteEmail} onChange={(event) => setRemoteEmail(event.target.value)} />
        <TextField size="small" label="비밀번호" type="password" autoComplete="current-password" value={remotePassword} onChange={(event) => setRemotePassword(event.target.value)} />
        <Button variant="contained" disabled={remoteBusy || !remoteEmail || !remotePassword} onClick={signInRemote}>REMOTE 로그인</Button>
      </div>}
    </section>

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <strong>PRODUCTION OPERATOR ACCEPTANCE GATE</strong>
          <p style={{ margin: '4px 0 0', color: '#667085', fontSize: 12 }}>Backend 연결과 실제 운영 승인 상태를 분리합니다. 아래 항목은 자동으로 READY 처리하지 않습니다.</p>
        </div>
        <Chip size="small" color="warning" label="MANUAL ACCEPTANCE REQUIRED" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(160px,1fr))', gap: 8, marginTop: 12 }}>
        <div style={{ border: '1px solid #e7ebf0', borderRadius: 9, padding: 10 }}><small style={{ color: '#667085' }}>REMOTE SESSION</small><strong style={{ display: 'block', marginTop: 3 }}>{remoteSession ? 'CONNECTED' : 'REQUIRED'}</strong></div>
        <div style={{ border: '1px solid #e7ebf0', borderRadius: 9, padding: 10 }}><small style={{ color: '#667085' }}>OWNER ROLE</small><strong style={{ display: 'block', marginTop: 3 }}>{remoteSession?.role === 'owner' ? 'SESSION OWNER' : 'REQUIRED'}</strong></div>
        <div style={{ border: '1px solid #e7ebf0', borderRadius: 9, padding: 10 }}><small style={{ color: '#667085' }}>PHYSICAL 2ND DEVICE</small><strong style={{ display: 'block', marginTop: 3 }}>E2E REQUIRED</strong></div>
        <div style={{ border: '1px solid #e7ebf0', borderRadius: 9, padding: 10 }}><small style={{ color: '#667085' }}>LEAKED PASSWORD PROTECTION</small><strong style={{ display: 'block', marginTop: 3 }}>DASHBOARD CHECK</strong></div>
      </div>
      <Alert severity="warning" sx={{ mt: 1.25 }}>OWNER 세션이 보여도 실제 운영자 계정 확인, 물리 2nd-device 동일 profile/role 검증, Supabase Dashboard 보안 설정 확인 전에는 Production READY가 아닙니다.</Alert>
    </section>

    {remoteSession && remoteSession.role !== 'owner' && <section style={{ background: '#fff', border: '1px solid #e4d7b8', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <strong>REMOTE OWNER BOOTSTRAP · ONE TIME</strong>
      <p style={{ color: '#667085', fontSize: 12 }}>최초 운영 OWNER가 아직 없을 때만 사용합니다. bootstrap key는 이 화면의 memory state에만 두고 성공 후 즉시 비웁니다.</p>
      <Alert severity="warning" sx={{ mb: 1.25 }}>성공 직후 서버의 <code>DAON_OWNER_BOOTSTRAP_KEY</code>를 rotate/remove해야 합니다. 두 번째 bootstrap은 서버에서 거부되어야 합니다.</Alert>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
        <TextField size="small" label="OWNER bootstrap key" type="password" autoComplete="off" value={ownerBootstrapKey} onChange={(event) => setOwnerBootstrapKey(event.target.value)} />
        <Button color="warning" variant="contained" disabled={remoteBusy || !ownerBootstrapKey} onClick={() => void bootstrapRemoteOwner()}>최초 OWNER 승격</Button>
      </div>
    </section>}

    {remoteSession?.role === 'owner' && <section style={{ background: '#fff', border: '1px solid #b7d8c2', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div><strong>REMOTE USER ADMIN · OWNER ONLY</strong><p style={{ margin: '4px 0 0', color: '#667085', fontSize: 12 }}>Production Supabase profile과 server-side owner-only administration을 직접 사용합니다.</p></div>
        <Button size="small" variant="outlined" disabled={remoteBusy} onClick={() => void loadRemoteProfiles()}>서버 프로필 새로고침</Button>
      </div>
      <Alert severity="info" sx={{ my: 1.25 }}>마지막 active OWNER 강등·비활성화, self-promotion, 비인가 role 변경은 UI가 아니라 Edge Function/RLS가 최종 차단합니다.</Alert>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px auto', gap: 8, marginBottom: 12 }}>
        <TextField size="small" label="초대 이메일" type="email" value={remoteInviteEmail} onChange={(event) => setRemoteInviteEmail(event.target.value)} />
        <TextField size="small" label="표시명(선택)" value={remoteInviteName} onChange={(event) => setRemoteInviteName(event.target.value)} />
        <TextField select size="small" label="초대 역할" value={remoteInviteRole} onChange={(event) => setRemoteInviteRole(event.target.value as AccessRole)}>{ROLES.map((role) => <MenuItem key={role} value={role}>{ROLE_LABELS[role]}</MenuItem>)}</TextField>
        <Button variant="contained" startIcon={<PersonAddAltRounded />} disabled={remoteBusy || !remoteInviteEmail} onClick={() => void inviteRemoteUser()}>REMOTE 초대</Button>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {remoteProfiles.map((profile) => <div key={profile.userId} style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,1fr) 160px 110px', gap: 8, alignItems: 'center', border: '1px solid #e7ebf0', borderRadius: 10, padding: 10 }}>
          <div><strong style={{ display: 'block', fontSize: 13 }}>{profile.displayName || profile.email || profile.userId}</strong><small style={{ color: '#667085' }}>{profile.email || 'email 미확인'} · {profile.active ? 'ACTIVE' : 'INACTIVE'}</small></div>
          <TextField select size="small" value={profile.role} disabled={remoteBusy} onChange={(event) => void updateRemoteRole(profile, event.target.value as AccessRole)}>{ROLES.map((role) => <MenuItem key={role} value={role}>{ROLE_LABELS[role]}</MenuItem>)}</TextField>
          <Button size="small" color={profile.active ? 'warning' : 'success'} disabled={remoteBusy} onClick={() => void toggleRemoteActive(profile)}>{profile.active ? '비활성화' : '활성화'}</Button>
        </div>)}
        {!remoteProfiles.length && <p style={{ color: '#7b8794', margin: 0 }}>서버 profile 목록을 아직 불러오지 않았습니다.</p>}
      </div>
    </section>}

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

    <Alert severity="warning" sx={{ mt: 1.5 }}>LOCAL POLICY 프로필은 UI 정책 테스트용이며 실제 원격 보안 권한이 아닙니다. REMOTE 데이터 접근은 production Auth 세션과 서버 RLS가 강제합니다.</Alert>
  </main>;
}
