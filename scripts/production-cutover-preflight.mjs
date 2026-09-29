const required = {
  VERCEL_TOKEN: process.env.VERCEL_TOKEN || '',
  VERCEL_ORG_ID: process.env.VERCEL_ORG_ID || '',
  VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID || '',
  SUPABASE_MANAGEMENT_TOKEN: process.env.SUPABASE_MANAGEMENT_TOKEN || '',
  DAON_PRODUCTION_OWNER_EMAIL: process.env.DAON_PRODUCTION_OWNER_EMAIL || '',
  DAON_PRODUCTION_OWNER_PASSWORD: process.env.DAON_PRODUCTION_OWNER_PASSWORD || '',
};

const productionBaseUrl = (process.env.DAON_PRODUCTION_BASE_URL || '').trim();
const presence = Object.fromEntries(Object.entries(required).map(([key, value]) => [key, Boolean(String(value).trim())]));
const missingSecrets = Object.entries(presence).filter(([, ok]) => !ok).map(([key]) => key);

let productionUrl = { configured: false, validHttpsOrigin: false };
if (productionBaseUrl) {
  productionUrl.configured = true;
  try {
    const url = new URL(productionBaseUrl);
    productionUrl.validHttpsOrigin =
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === '/';
  } catch {
    productionUrl.validHttpsOrigin = false;
  }
}

const status = {
  vercelDeploymentCredentialsReady: presence.VERCEL_TOKEN && presence.VERCEL_ORG_ID && presence.VERCEL_PROJECT_ID,
  supabaseAuthSecurityCredentialReady: presence.SUPABASE_MANAGEMENT_TOKEN,
  productionOwnerCredentialReady: presence.DAON_PRODUCTION_OWNER_EMAIL && presence.DAON_PRODUCTION_OWNER_PASSWORD,
  productionUrl,
  missingSecrets,
  writesPerformed: 0,
};

console.log(JSON.stringify(status, null, 2));
if (missingSecrets.length || (productionBaseUrl && !productionUrl.validHttpsOrigin)) process.exitCode = 2;
