# remote-auth-admin Edge Function

Status: **DEPLOYED / PRODUCTION CONNECTED**

Deploy only to a dedicated DA:ON real-estate Supabase project. Never deploy to GPS Tracker or Sports AI projects.

## Purpose

This server boundary performs the privileged REMOTE AUTH operations that must never be implemented with browser-side `service_role` credentials:

- first OWNER bootstrap
- user invitation
- role changes
- active/inactive changes
- profile administration list

The ordinary browser login/session flow is separate and uses the public Supabase anon key. This function is only for privileged administration.

## Required migrations

Apply first:

- `supabase/migrations/20260916_auth_profiles_rls.sql`

The migration creates `profiles`, the default `viewer` role, the new-user trigger, and owner-only RLS administration boundaries.

## Required server environment

Supabase-provided:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Project-specific:

- `DAON_OWNER_BOOTSTRAP_KEY`
  - server-only secret
  - minimum 32 characters
  - never embed in frontend code, `.env` committed files, screenshots, or browser storage
  - used only for the one-time first OWNER bootstrap
- `AUTH_ADMIN_ALLOWED_ORIGINS`
  - comma-separated exact production origins
  - no wildcard origin

## Deployment

This function should keep normal Supabase JWT verification enabled because every action requires an authenticated user.

```bash
supabase functions deploy remote-auth-admin
```

Do **not** use `--no-verify-jwt` for this function.

## Bootstrap rule

The first OWNER is not created automatically.

`bootstrap_owner` requires all of the following:

1. a valid authenticated Supabase user JWT
2. `DAON_OWNER_BOOTSTRAP_KEY` configured on the server
3. the matching bootstrap key supplied for the one-time bootstrap request
4. zero active OWNER profiles currently present

Once one active OWNER exists, `bootstrap_owner` returns `bootstrap_already_completed` and cannot be used again.

After successful bootstrap, rotate or remove `DAON_OWNER_BOOTSTRAP_KEY` from the deployed environment.

## API actions

All calls are `POST` JSON with `action`.

### bootstrap_owner

Trusted one-time bootstrap only.

```json
{
  "action": "bootstrap_owner",
  "bootstrapKey": "server-provisioned-secret"
}
```

### invite_user

Active OWNER only.

```json
{
  "action": "invite_user",
  "email": "user@example.com",
  "displayName": "사용자",
  "role": "viewer"
}
```

Allowed roles: `owner`, `admin`, `editor`, `viewer`.

### update_role

Active OWNER only.

```json
{
  "action": "update_role",
  "userId": "uuid",
  "role": "editor"
}
```

The last active OWNER cannot be demoted.

### set_active

Active OWNER only.

```json
{
  "action": "set_active",
  "userId": "uuid",
  "active": false
}
```

The last active OWNER cannot be deactivated.

### list_profiles

Active OWNER only.

```json
{
  "action": "list_profiles"
}
```

## Security invariants

- `service_role` is server-only
- exact-origin CORS allowlist; no wildcard origin
- all actions require authenticated user JWT
- privileged administration requires active OWNER
- first OWNER bootstrap requires a separate server bootstrap secret
- bootstrap is disabled after the first active OWNER exists
- bootstrap secret comparison avoids early-exit string comparison
- new Auth users default to `viewer` through the DB trigger
- no browser self-promotion path
- last active OWNER cannot be demoted or deactivated
- responses use `Cache-Control: no-store`

## Production verification

Before REMOTE AUTH is marked READY, verify against the dedicated backend:

1. create first Auth user
2. wrong bootstrap key is rejected
3. correct bootstrap promotes exactly one OWNER
4. second bootstrap attempt is rejected
5. rotate/remove bootstrap secret
6. OWNER invites viewer/editor/admin users
7. non-OWNER administration attempt is rejected
8. OWNER role update persists across devices
9. last OWNER demotion/deactivation is rejected
10. inactive profile cannot pass application access checks
11. anon user cannot read `profiles`
12. browser bundle contains no `service_role` or bootstrap secret
