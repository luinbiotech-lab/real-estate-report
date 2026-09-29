const projectUrl = 'https://neeqcfxjwotyiodrlzvq.supabase.co';
const publishableKey = 'sb_publishable_JNF2rkRVzdMuJCdyTwoi9w_3sFRQbrX';
const email = process.env.DAON_PRODUCTION_OWNER_EMAIL?.trim() || '';
const password = process.env.DAON_PRODUCTION_OWNER_PASSWORD || '';

if (!email || !password) throw new Error('Production OWNER credentials are required.');

const headers = {
  apikey: publishableKey,
  'Content-Type': 'application/json',
};

const login = await fetch(`${projectUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ email, password }),
});
const loginText = await login.text();
let loginPayload = {};
try { loginPayload = loginText ? JSON.parse(loginText) : {}; } catch {}

if (!login.ok) {
  const detail = loginPayload?.error_description || loginPayload?.msg || loginPayload?.message || loginPayload?.error || '';
  throw new Error(`Production OWNER direct auth failed (${login.status})${detail ? `: ${detail}` : ''}`);
}

const accessToken = loginPayload?.access_token;
const userId = loginPayload?.user?.id;
if (!accessToken || !userId) throw new Error('Production OWNER direct auth returned incomplete session.');

const profileUrl = new URL(`${projectUrl}/rest/v1/profiles`);
profileUrl.searchParams.set('select', 'user_id,role,is_active');
profileUrl.searchParams.set('user_id', `eq.${userId}`);
profileUrl.searchParams.set('limit', '1');

const profileRes = await fetch(profileUrl, {
  headers: {
    apikey: publishableKey,
    Authorization: `Bearer ${accessToken}`,
  },
});
const profileText = await profileRes.text();
let profiles = [];
try { profiles = profileText ? JSON.parse(profileText) : []; } catch {}

if (!profileRes.ok) throw new Error(`Production OWNER profile read failed (${profileRes.status})`);
const profile = Array.isArray(profiles) ? profiles[0] : undefined;
if (!profile) throw new Error('Production OWNER profile not found.');
if (profile.role !== 'owner' || profile.is_active !== true) {
  throw new Error(`Production OWNER profile mismatch: role=${profile.role ?? 'unknown'}, active=${String(profile.is_active)}`);
}

console.log(JSON.stringify({
  auth: 'PASS',
  profileRead: 'PASS',
  role: 'owner',
  active: true,
}, null, 2));
console.log('Production OWNER direct auth probe: PASS');
