# remote-public-share Edge Function

Status: **PREPARED ONLY / NOT DEPLOYED**

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

- `PUBLIC_SHARE_BASE_URL`
  - public viewer URL, for example `https://share.example.com/view`
  - issuance appends the raw token only as a URL fragment: `#token=...`
  - fragments are not sent in the HTTP request line
- `PUBLIC_SHARE_ALLOWED_ORIGINS`
  - comma-separated exact browser origins
  - example: `https://app.example.com,https://share.example.com`
  - browser origins not in this allowlist are rejected

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

## API contract

All calls are `POST` JSON with `action`.

### issue — authenticated OWNER/ADMIN

Input:

```json
{
  "action": "issue",
  "snapshot": { "id": "...", "propertyId": "...", "schemaVersion": "..." },
  "expiresAt": "2026-12-31T00:00:00.000Z",
  "allowDownload": false,
  "recipientNote": "optional"
}
```

The full sanitized immutable snapshot is stored as `snapshot_payload`. The response contains `rawToken` and `publicUrl` **once**. Only `token_hash` is persisted.

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
- snapshot payload is recursively stripped of obvious secret/private-key/token fields before persistence
- responses use `Cache-Control: no-store`

Before Production READY, exercise issue → resolve → review → revoke → blocked resolve E2E against the dedicated backend.
