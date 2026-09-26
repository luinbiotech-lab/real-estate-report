export const DAON_SUPABASE_PROJECT_URL =
  import.meta.env.VITE_SUPABASE_URL?.trim() ||
  'https://neeqcfxjwotyiodrlzvq.supabase.co';

export const DAON_SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  'sb_publishable_JNF2rkRVzdMuJCdyTwoi9w_3sFRQbrX';

export const DAON_REMOTE_AUTH_FUNCTION = 'remote-auth-admin';
export const DAON_REMOTE_SHARE_FUNCTION = 'remote-public-share';
