# DA:ON Vercel Production Environment Contract

This file records **names and scopes only**. Never commit real secret values.

## Browser-safe build variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` or approved anon credential
- `VITE_KAKAO_JAVASCRIPT_KEY`
- `VITE_API_BASE_URL` = blank for same-origin Vercel `/api`

## Server-only Vercel Function variables

- `NAVER_MAP_CLIENT_ID`
- `NAVER_MAP_CLIENT_SECRET`
- `KAKAO_REST_API_KEY`
- `MAP_PROXY_ALLOWED_ORIGINS`

Rules:

- server-only credentials must never use the `VITE_` prefix
- `MAP_PROXY_ALLOWED_ORIGINS` must contain exact HTTPS origins only
- wildcard `*` is prohibited
- Vercel's `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL` may be accepted automatically by the serverless adapter for same-project requests
- Supabase `service_role`, `sb_secret_`, and `DAON_OWNER_BOOTSTRAP_KEY` are not required by the map/POI functions and must not be exposed to the browser

## Required post-deploy acceptance

Run against the actual HTTPS origin:

```bash
DAON_PRODUCTION_BASE_URL=https://<vercel-production-origin> npm run test:prod-http
```

Expected:

- `/healthz` 200
- SPA root + Bangbae deep-link fallback
- security headers
- `/api/status` 200
- provider configured booleans only; no secret values
- NAVER geocode/static and Kakao POI live checks after provider allowlists are configured

## Production migration boundary

A successful Vercel deploy does **not** authorize Supabase Production migration. The final Bangbae dry-run must still have technical blocker = 0 and the exact human approval `MIGRATE TO PRODUCTION` must be recorded against that plan.
