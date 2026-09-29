import { existsSync, readFileSync } from 'node:fs';

const path = '.github/workflows/deploy-vercel-production.yml';
if (!existsSync(path)) throw new Error('Vercel Production deployment workflow missing.');
const text = readFileSync(path, 'utf8');

for (const marker of [
  'workflow_dispatch:',
  'DEPLOY DAON PRODUCTION',
  'secrets.VERCEL_TOKEN',
  'secrets.VERCEL_ORG_ID',
  'secrets.VERCEL_PROJECT_ID',
  'npm run readiness:prod',
  'node scripts/validate-vercel-deployment.mjs',
  'vercel pull --yes --environment=production',
  'vercel build --prod',
  'vercel deploy --prebuilt --prod',
  'npm run test:prod-http',
  'Supabase Production migration: NOT AUTHORIZED BY THIS WORKFLOW',
]) {
  if (!text.includes(marker)) throw new Error(`Guarded Vercel deployment marker missing: ${marker}`);
}

for (const forbidden of ['sb_secret_', 'service_role', 'NAVER_MAP_CLIENT_SECRET=', 'KAKAO_REST_API_KEY=']) {
  if (text.includes(forbidden)) throw new Error(`Deployment workflow must not hardcode secret material: ${forbidden}`);
}

console.log('Guarded Vercel production deployment workflow: PASS');
