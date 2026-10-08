# DA:ON Production Release Gate — 2026-10-07

## Baselines

- Repository: `luinbiotech-lab/real-estate-report`
- Release branch: `feat/daon-master-code-lock`
- Release candidate HEAD: `e16cfba8d68cec78d09ea9ea23429b35bc713e24`
- Current public Production commit: `e16cfba8d68cec78d09ea9ea23429b35bc713e24`
- Public Production alias: `https://real-estate-report-lime.vercel.app`
- Production Supabase project: `neeqcfxjwotyiodrlzvq`

Production deployment completed on 2026-10-08. Public alias is serving the release candidate HEAD.

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

The current Production commit contains this fix.

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

## Production deployment status

### Deployment

- Production deployment ID: `dpl_EmPYJbTUet2LKnzBUeaWHuR2w39g`
- State: `READY`
- Public alias: `https://real-estate-report-lime.vercel.app`
- Production HEAD: `e16cfba8d68cec78d09ea9ea23429b35bc713e24`
- Recent Vercel runtime errors after deployment: 0
- Production root HTTP: 200
- Auth Gate is active on protected routes.
- Production Auth Gate displays sessionStorage-based reload persistence policy.

The prior Hobby deployment quota block has cleared.

### Bangbae 815-11 live data

Canonical Production property ID is `sample-bangbae-815-11`. Legacy local/cutover fixtures retain `daon-bangbae-815-11` through an explicit identity alias.

Production live state:
- property media policy: interior photos prohibited; exterior / roadview / map allowed
- typed spaces: 5
- viewer scenes: 1
- viewer nodes: 5
- viewer edges: 4
- walkthrough routes: 1
- walkthrough steps: 5
- verification events: 11
- report snapshots: 3
- actual floor plans: 0
- actual media assets: 0

Restored provenance:
- comparable transaction source: 6 rows, source-row provenance 6/6 complete, independent official-source verification remains false
- exterior evidence source: Library-backed DA:ON detailed report, pages 1/3; direct media asset remains not connected
- no interior media was migrated
- Roadview pano provenance was not restored because no trusted current repository / DB / Library record containing the prior pano ID was found

### Live checks still required

1. Sign in with a real operator account.
2. Refresh the page and confirm the operator remains signed in.
3. Open Bangbae 815-11 Data Room and verify typed spatial / Viewer / Walkthrough against live data.
4. Upload a small real Excel file first; verify Property + provenance + report generation.
5. Run the intended bulk Excel import.
6. Verify Property list pagination and report generation after the bulk import.
7. Perform second-device/browser login and report/share smoke test.
8. Only then mark the release fully operational.

## Production safety

- Do not overwrite or synthesize missing Bangbae floor plan/media.
- Bangbae seller media policy continues to prohibit interior photographs.
- Do not convert estimated raster geometry into measured/BIM status without evidence.
- Do not change `DAON_1P_MASTER` or `DAON_DETAIL_7P_MASTER` design during deployment.
- Supabase destructive/no-overwrite safeguards remain mandatory.
