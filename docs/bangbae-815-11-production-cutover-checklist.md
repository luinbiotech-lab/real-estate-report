# Bangbae 815-11 Production Cutover Checklist

Property: `daon-bangbae-815-11`  
Branch: `feat/daon-master-code-lock`  
Platform baseline: `9c7553b1962df27b57a7789cd07eca3abcdcdf9f`  
Latest passing platform run: `36138989670`

This checklist covers only the remaining real-data / real-operator cutover work. Platform-body code is complete. Report visual design remains a separate scope.

## Gate 0 — Do not write yet

Bangbae must remain absent from Production until all mandatory gates below are satisfied and the operator explicitly approves the controlled migration.

Hard rules:

- no synthetic document binary
- no fake exterior media
- no report-page screenshot promoted as an original photo asset
- no synthetic Digital Twin geometry without source material
- no implicit overwrite of an existing Production property
- no Production write without exact phrase `MIGRATE TO PRODUCTION` and the final confirmation dialog

## Gate 1 — Required official documents

Required readiness classes:

1. building register
2. land register
3. land-use plan
4. registry

Current source-presence state:

- building register — confirmed
- land-use plan — confirmed
- registry — confirmed through land/building registry originals
- land register — **not yet confirmed**
- cadastral map — not yet confirmed; additional material, not one of the four required classes

Action:

- obtain/confirm the Bangbae land-register original
- keep cadastral map as an additional completeness item

Stop condition:

- if the land-register original cannot be verified, keep Content Readiness = INCOMPLETE and do not represent required documents as complete

## Gate 2 — Connect official-document binaries

Confirmed source presence is not a Storage connection.

For each confirmed official document:

1. register the actual PDF in Data Room as a PropertyDocument
2. verify the document type
3. ensure local migration binary is present
4. run Bangbae-scoped dry run
5. confirm a private Storage upload is planned
6. after migration, verify private Storage round-trip and metadata reconciliation

Required boundary:

`source presence → local binary → private Storage connection → official verification`

Do not skip or collapse these states.

## Gate 3 — Direct exterior / road / neighborhood media

Already complete at platform level:

- Roadview provenance
- embedded-report exterior evidence
- exterior-only seller policy
- interior exclusion
- upload/classification/primary-photo workflow

Still required:

- at least one real JPEG/PNG/WebP exterior, road or neighborhood image binary
- classify it as an allowed exterior category
- select the primary exterior media if appropriate
- ensure it enters the private Storage migration plan

Stop condition:

- if only Roadview or embedded-report evidence is available, keep direct media asset status unconnected

## Gate 4 — Real operator OWNER acceptance

Current Production account state is QA-oriented.

Required:

1. create/verify the real operator Auth account
2. confirm `profiles.role = owner`
3. confirm `is_active = true`
4. verify OWNER-only remote user administration
5. verify last-owner protection
6. do not remove QA accounts until real OWNER acceptance is complete

## Gate 5 — Supabase security

Required manual check:

- enable/check Supabase Leaked Password Protection

Current known state:

- security advisor reports Leaked Password Protection Disabled

This is a manual Production security gate and must not be auto-marked complete.

## Gate 6 — Production host / domain / TLS

Deployable package is complete:

- self-hosted production frontend
- protected map/POI proxy
- same-origin `/api/*` reverse proxy
- Docker image
- browser secret scan
- runtime/container smoke

Still external:

1. production host
2. production domain
3. TLS
4. final NAVER/Kakao provider/domain allowlists
5. exact proxy origin allowlist

After host connection run:

```bash
DAON_PRODUCTION_BASE_URL=https://<frontend-origin> \
DAON_PRODUCTION_API_BASE_URL=https://<api-origin> \
npm run test:prod-http
```

If same-origin, `DAON_PRODUCTION_API_BASE_URL` may be omitted.

## Gate 7 — Physical second-device E2E

Required on a separate physical browser/device:

1. sign in as the real operator OWNER
2. open Bangbae after migration
3. confirm the same Property/Data Room data
4. confirm document/media access according to role
5. confirm public-share behavior
6. confirm revoke/expiry behavior
7. confirm no local-only state divergence

Do not replace this with another browser context on the same machine.

## Gate 8 — Digital Twin release decision

Platform is complete, source asset is not.

If Digital Twin is required for the initial release:

- supply a real floor plan / DWG / DXF / 360 / GLB or other approved source
- keep file size <= 50MiB
- preserve `sourceDocumentId`
- use verified B1 / 1F / 2F / 3F floor options
- require human review before geometry promotion

If Digital Twin is not required for the initial release:

- release may proceed without it
- keep the Digital Twin readiness state explicitly missing/pending
- do not fabricate geometry

## Gate 9 — Bangbae-only dry run

Target:

`daon-bangbae-815-11`

Requirements:

- global company settings excluded
- no existing remote Bangbae property
- all required local binary blockers resolved
- direct media binary included if release requires media completeness
- Content Readiness reviewed separately from Structural Migration Ready
- dry-run manifest exported and retained

Expected result before real migration:

- structural blocker count = 0
- Content Readiness status reflects actual data truth
- Production external gates reviewed manually

## Gate 10 — Controlled Production migration

Only after Gates 1–9 are reviewed.

Execution:

1. rerun dry run immediately before cutover
2. verify no existing remote Bangbae property
3. verify blocker count = 0
4. enter exact approval phrase: `MIGRATE TO PRODUCTION`
5. accept final confirmation dialog
6. execute once
7. do not retry blindly if interrupted

If interrupted after remote writes begin:

- treat as possible partial write
- inspect remote state first
- reconcile before any retry
- initial migration must not overwrite an existing remote Bangbae property

## Gate 11 — Post-migration reconciliation

Required reconciliation:

- Property
- property objects
- property assets
- verification candidates
- verifications
- report snapshots
- private Storage objects

Then verify:

- Bangbae exists in Production exactly once
- expected counts match
- official-document binary round-trip works
- direct media round-trip works
- no forbidden interior media is exposed
- public share uses only permitted media/data
- admin/OWNER can read the migrated record

## Release completion definition

Bangbae Production cutover is complete only when:

- required official-document readiness is truthful
- required binaries are connected
- direct exterior media requirement is satisfied or explicitly waived for release scope
- real operator OWNER is accepted
- Leaked Password Protection is enabled/checked
- production host/domain/TLS and provider allowlists are live
- physical second-device E2E passes
- controlled migration succeeds
- reconciliation passes

Until then, the correct state is:

`PLATFORM COMPLETE / PRODUCTION CUTOVER PENDING`
