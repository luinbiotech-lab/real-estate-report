# DA:ON Real Estate Platform — Production Backend Cutover Report

Date: 2026-09-17
Supabase project: `real-estate-report-production`
Region: Seoul (`ap-northeast-2`)
Project ref: `neeqcfxjwotyiodrlzvq`

## Executive status

Dedicated real-estate Supabase backend is provisioned and healthy. Core Auth/Profile schema, Property/Data RLS, private Storage, external-share tables, and both Edge Functions are deployed. Server-side role/RLS and controlled-migration reconciliation tests passed. The frontend remains local-first until the production frontend is wired to the prepared Supabase adapters.

## 1–10 execution status

1. **Project cost / plan** — DONE
   - LUINBIOTECH organization upgraded to Pro.
   - Additional project compute cost confirmed before creation/use.

2. **Dedicated real-estate project** — DONE
   - `real-estate-report-production`
   - Seoul region
   - Existing GPS Tracker / Sports AI projects were not reused.

3. **Project health / public browser credential** — DONE
   - Project status: ACTIVE_HEALTHY.
   - Browser-safe publishable key exists.
   - Server credentials remain outside browser code.

4. **Auth / Profile / Role RLS** — DONE
   - `owner/admin/editor/viewer`
   - profile trigger and default `viewer`
   - anonymous profile access blocked
   - OWNER-only role/status management boundary

5. **OWNER bootstrap** — DONE FOR QA BASELINE
   - Active QA roles confirmed: OWNER 1 / EDITOR 1 / VIEWER 1.
   - QA identities use non-production test identities.
   - Real human OWNER onboarding is still a production-user onboarding task, not a schema blocker.

6. **Property/Data RLS + Private Storage** — DONE
   - Properties / modular objects / verification / report snapshots / company settings deployed.
   - Private bucket `daon-property-assets` exists with 50 MiB hard cap.
   - Binary-bearing document/media/Digital Twin resources remain outside JSONB payloads.

7. **Edge Functions** — DONE
   - `remote-auth-admin`: ACTIVE / JWT verification enabled.
   - `remote-public-share`: ACTIVE / function-level custom authentication/token validation.

8. **Controlled migration baseline** — DONE
   - QA controlled property: `qa-controlled-migration-001`.
   - One linked `propertyDataSources` object confirmed.
   - Database reconciliation baseline established.

9. **RLS / second-session reconciliation** — SERVER-SIDE PASS
   - VIEWER can read but cannot update.
   - EDITOR can update but cannot delete Property.
   - OWNER can delete Property (rollback test only).
   - EDITOR may create draft report snapshots but final snapshot is blocked by RLS.
   - OWNER final snapshot insert is permitted.
   - EDITOR verification approval is blocked.
   - OWNER verification approval is permitted.
   - OWNER and VIEWER sessions returned the same payload hash for the controlled property.
   - Actual physical second-device browser test remains part of frontend production cutover.

10. **REMOTE / PUBLIC share** — BACKEND DEPLOYED / PUBLIC DELIVERY NOT YET LIVE
   - external share session/review tables deployed.
   - raw-token storage prohibited; server stores `token_hash` only.
   - direct anon/authenticated table grants revoked; access is Edge-Function-only.
   - `remote-public-share` function is active with snapshot checksum/signature validation, expiry, revoke, download-policy, and review-note logic.
   - Remaining live-delivery dependencies: public viewer/frontend host, production origin allowlist, and production Auth session wiring.

## Security hardening applied

- External-share direct table grants revoked from `anon` and `authenticated`.
- RLS helper SECURITY DEFINER functions moved behind non-exposed `private` schema.
- Obsolete public helper RPC execution revoked.
- Supabase Security Advisor no longer reports anonymous or authenticated public SECURITY DEFINER helper exposure.
- Expected INFO remains for external-share tables with RLS and no direct policies; this is intentional deny-all / Edge-only design.

## Security Advisor follow-up

One operational Auth warning remains:

- **Leaked Password Protection Disabled** — enable Supabase Auth leaked-password protection before real user onboarding.

This is a dashboard/Auth configuration item and does not require schema changes.

## Performance Advisor follow-up

Non-blocking performance recommendations remain for production scaling:

- covering indexes for several audit-user foreign keys
- RLS init-plan optimization for direct `auth.uid()` calls
- Auth DB connection strategy review when instance size increases

These do not block the current controlled-migration baseline.

## Current production boundary

Backend READY:
- dedicated Supabase project
- Auth/Profile/RLS schema
- Property/Data RLS
- private Storage
- QA role matrix
- controlled migration baseline
- Edge Functions
- server-side RLS/reconciliation tests

Still required for full user-facing Production READY:
- real human OWNER onboarding
- frontend runtime provider wiring with project URL + publishable key
- production frontend/public viewer host
- protected map/POI proxy deployment
- provider/domain allowlists
- leaked-password protection toggle
- actual browser second-device E2E
- public share issue → resolve → review → revoke browser E2E

Do not mark the full product Production READY until those user-facing deployment items pass.
