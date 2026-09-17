# remote-public-share Edge Function

Status: **DEPLOYED / PRODUCTION CONNECTED**

Deploy this function only to a dedicated DA:ON real-estate Supabase project. Do not deploy it to GPS Tracker or Sports AI projects.

## Why JWT verification is disabled at the platform gateway

The same function serves two classes of actions:

- authenticated management: `issue`, `revoke`, `list`
- anonymous token access: `resolve`, `add_review`

Therefore deployment must use `--no-verify-jwt`. This does **not** make management actions anonymous: `issue`, `revoke`, and `list` explicitly call `auth.getUser()` and require an active `profiles.role` of `owner` or `admin` inside the function.

## Required secrets / environment

Supabase-provided server environment:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Project-specific server environment:

- `PUBLIC_SHARE_BASE_URL` (optional)
  - 별도 public viewer host가 있으면 해당 URL을 사용
  - 비어 있으면 Edge Function 자신의 GET URL을 self-hosted viewer로 사용
  - issuance appends the raw token only as a URL fragment: `#token=...`
  - fragments are not sent in the HTTP request line
- `PUBLIC_SHARE_ALLOWED_ORIGINS`
  - comma-separated exact cross-origin browser origins
  - same-origin self-hosted viewer는 자동 허용
  - example: `https://app.example.com`
  - 그 외 browser origins not in this allowlist are rejected

Never put `SUPABASE_SERVICE_ROLE_KEY` in frontend environment variables.

## Required migrations

Apply in the dedicated real-estate backend before deploying:

1. `supabase/migrations/20260916_auth_profiles_rls.sql`
2. `supabase/migrations/20260915_external_public_share.sql`

## Deploy command

```bash
supabase functions deploy remote-public-share --no-verify-jwt
```

Do not omit `--no-verify-jwt`: public token resolve/review requests do not carry a Supabase user JWT. Management actions remain protected by explicit in-function user/profile checks.

## Self-hosted viewer

`GET /functions/v1/remote-public-share`는 read-only HTML viewer를 반환한다.

- `#token=...` fragment를 읽은 뒤 즉시 `history.replaceState`로 주소에서 제거
- 같은 Edge Function으로 `resolve` POST
- revoked / expired / not_found 접근 차단
- `allowDownload=true`일 때만 JSON 저장 버튼 노출
- `Cache-Control: no-store`, CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`
- Snapshot payload는 `textContent`로만 표시하고 HTML로 삽입하지 않음

## API contract

Management/token API calls are `POST` JSON with `action`.

### issue — authenticated OWNER/ADMIN

Input includes the complete `BuildingReleaseSnapshot` plus expiry/download policy. Before persistence the server verifies:

- `schemaVersion === daon-building-release-snapshot-v1`
- `immutable === true`
- canonical package matches `canonicalPackage`
- SHA-256 checksum matches `checksumHex`
- ECDSA P-256 / SHA-256 signature verifies against `publicKeyJwk`

Only after successful integrity verification is the sanitized immutable snapshot stored as `snapshot_payload`. The response contains `rawToken` and `publicUrl` **once**. Only `token_hash` is persisted.

### resolve — anonymous token access

```json
{ "action": "resolve", "rawToken": "..." }
```

The server hashes the presented token, then rejects not-found, revoked, or expired sessions before returning `snapshot_payload`.

### add_review — anonymous token access

```json
{
  "action": "add_review",
  "rawToken": "...",
  "author": "검토자",
  "body": "검토 의견"
}
```

Review writes use the same token validation and reject revoked/expired sessions.

### revoke — authenticated OWNER/ADMIN

```json
{ "action": "revoke", "remoteShareId": "uuid" }
```

### list — authenticated OWNER/ADMIN

```json
{ "action": "list", "snapshotId": "..." }
```

List responses intentionally contain no raw token and no reconstructable public URL.

## Security invariants

- 32-byte cryptographically random raw token
- SHA-256 token hash persisted; raw token never persisted
- raw token returned only on `issue`
- public URL uses URL fragment, not query/path token
- no anonymous table policies
- service role exists only inside Edge Function environment
- exact-origin CORS allowlist; no wildcard origin
- `issue/revoke/list` require active `owner` or `admin`
- `resolve/add_review` validate hash + revoke + expiry before access
- Release Snapshot canonical/checksum/signature integrity is verified before issuance
- snapshot payload is recursively stripped of obvious secret/private-key/token fields before persistence
- responses use `Cache-Control: no-store`

Production rollout must exercise valid issue → resolve → review → revoke → blocked resolve, plus tampered-snapshot issuance rejection, against the dedicated backend. Self-hosted viewer GET + invalid-token resolve are already part of the production smoke boundary.
