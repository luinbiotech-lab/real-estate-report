# DA:ON Production Release Gate — 2026-10-07

## Baselines

- Repository: `luinbiotech-lab/real-estate-report`
- Release branch: `feat/daon-master-code-lock`
- Release candidate HEAD: `fe8b0a44972441d26515c4530b99d76d4116a26c`
- Current public Production commit: `9836ced84e9b0fe4eb9376da6fbcda44cdd824ce`
- Public Production alias: `https://real-estate-report-lime.vercel.app`
- Production Supabase project: `neeqcfxjwotyiodrlzvq`

The public Production deployment is behind the release branch. Do not treat the following fixes as live until a new Production deployment is completed.

## Release candidate verified

### Build / security

- npm audit: 0 vulnerabilities
- typecheck: PASS
- production build: PASS
- DA:ON report master integrity: PASS
- import regression validation: PASS
- Supabase remote data adapter validation: PASS
- Production readiness validator: PASS
- Supabase Security Advisor: 0 lints

### Report master

Professional Report wrapper is locked to:

1. Opening page: 1
2. `DAON_DETAIL_7P_MASTER`: 7
3. Closing page: 1

Browser verification: 9 total pages, 0 browser errors.

### Auth refresh

Release branch uses browser `sessionStorage` for Supabase access/refresh tokens.

- Password is not stored.
- Reload in the same browser tab restores the auth token state.
- Logout/session end clears the browser-session token state.
- Browser reload E2E: PASS.

The current Production commit does not contain this fix.

### Spatial / 3D

Verified flow:

`floor plan -> agent review -> raster calibration -> manual space mapping -> typed spatial -> schematic 3D -> viewer scene -> walkthrough -> GLB export -> Three.js GLB reload -> report spatial snapshot`

Generated raster/GLB models remain explicitly `estimated / schematic`, never measured BIM unless separately verified.

### Excel / portfolio scale

- Maximum Excel import: 5,000 rows.
- Duplicate detection: indexed O(n) path.
- Import UI renders 20 rows per page.
- 5,000-row test file: ~1.6 MB.
- Browser parse/load test: ~3.3 sec.
- 5,000-row save test: ~6.7 sec in Sandbox local mode.
- Result: 5,000 saved / 0 failed / 20 save batches.
- Remote save contract: 250-row batch insert for Property and provenance.
- Remote PostgREST contract uses ignore-duplicate conflict handling.
- Production Supabase rollback dry-run: 2 Properties + 2 DataSources inserted under authenticated owner/RLS context, then rollback; residual rows 0.
- Property list renders 50 rows per page after large import.
- 5,003-property browser test: 50 DOM rows / 101 pages.
- Bulk verification candidates: 50 rows per page; 120-row test = 50 / 50 / 20.
- Excel-created report values preserve the Excel DataSource id in `sourceIds`.

### Bundle split

Route-level lazy loading is enabled.

Before route split:
- main JS ~1.88 MB minified / ~571 KB gzip.

After route split:
- main JS ~585 KB minified / ~187 KB gzip.

Excel, Digital Twin, report and Three.js code load as separate route/runtime chunks.

## Current deployment blockers

### Vercel deployment quota

The Vercel Hobby project reached the daily deployment API limit.

Observed error:
- HTTP 402
- code: `api-deployments-free-per-day`
- deployment rate limited; retry after 24 hours.

GitHub combined status failure for the feature branch is currently the Vercel rate-limit status, not a compile/test failure.

### Preview protection

Existing feature previews are protected by Vercel Deployment Protection / SSO. Anonymous browser automation receives HTTP 302 to Vercel SSO.

### Live checks still required after deploy

1. Deploy the release candidate after the Vercel quota clears.
2. Confirm the public Production alias points to the new commit.
3. Sign in with a real operator account.
4. Refresh the page and confirm the operator remains signed in.
5. Open Bangbae 815-11 Data Room and verify typed spatial / Viewer / Walkthrough.
6. Upload a small real Excel file first; verify Property + provenance + report generation.
7. Run the intended bulk Excel import.
8. Verify Property list pagination and report generation after the bulk import.
9. Perform second-device/browser login and report/share smoke test.
10. Only then mark Production migration/release complete.

## Production safety

- Do not overwrite or synthesize missing Bangbae floor plan/media.
- Bangbae seller media policy continues to prohibit interior photographs.
- Do not convert estimated raster geometry into measured/BIM status without evidence.
- Do not change `DAON_1P_MASTER` or `DAON_DETAIL_7P_MASTER` design during deployment.
- Supabase destructive/no-overwrite safeguards remain mandatory.
