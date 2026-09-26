const projectRef = process.env.SUPABASE_PROJECT_REF?.trim() || '';
const token = process.env.SUPABASE_MANAGEMENT_TOKEN?.trim() || '';
const confirmation = process.env.DAON_AUTH_SECURITY_CONFIRMATION?.trim() || '';

if (!projectRef) throw new Error('SUPABASE_PROJECT_REF가 필요합니다.');
if (!token) throw new Error('SUPABASE_MANAGEMENT_TOKEN이 필요합니다.');
if (confirmation !== 'ENABLE LEAKED PASSWORD PROTECTION') {
  throw new Error('정확한 보안 설정 승인 문구가 필요합니다.');
}

const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ password_hibp_enabled: true }),
  redirect: 'error',
  cache: 'no-store',
});

const text = await response.text();
let payload = {};
if (text) {
  try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
}
if (!response.ok) {
  throw new Error(`Supabase Auth config update failed (${response.status}): ${JSON.stringify(payload)}`);
}
if (payload.password_hibp_enabled !== true) {
  throw new Error(`Supabase response did not confirm password_hibp_enabled=true: ${JSON.stringify(payload)}`);
}

console.log(JSON.stringify({
  projectRef,
  passwordHibpEnabled: true,
  endpoint: '/v1/projects/{ref}/config/auth',
}, null, 2));
console.log('Supabase leaked-password protection enablement: PASS');
