# DA:ON Real Estate — Claude Full Project Handoff

**Baseline date:** 2026-10-14 (Asia/Seoul)  
**Repository:** `luinbiotech-lab/real-estate-report`  
**Working branch:** `feat/daon-master-code-lock`  
**Verified baseline SHA prior to this onboarding:** `7ff56aa624cdbbe0641acca99bcea24f383e95da`  
**Production deployment observed READY:** `dpl_FwYoc9HgitxbzmzTLCnD3ksboZQi`

This document is a *context handoff*, not evidence that Claude has been authenticated or invoked. Re-check live state at every new session.

## 1. Why this business exists
The user wants a professional, repeatable property intelligence business, not merely a listing editor or PDF factory. The operating system combines official property records, transaction market observations, field evidence, property/media spatial context and approval-controlled AI analysis. Commercial ambition includes defensible source-quality standards, data lineage, versioned comparison/report products, service automation, B2B distribution and gradual platform expansion. Preserve independent DA:ON business identity alongside LUIN common agent infrastructure.

## 2. Product mental model
```
Query address/lot
 → Kakao location and parcel identity
 → duplicate check: existing Property → same Data Room; otherwise new Property
 → provider-specific ingestion with partial-failure isolation
 → source/evidence metadata + timestamps + original units
 → conflicting values → non-destructive verification candidates
 → owner/reviewer decision → approved Property state
 → Data Room / floors / space & media / market comparisons
 → report ViewModel + provenance & quality gates
 → DAON_1P_MASTER / DAON_DETAIL_7P_MASTER
 → versioned Report Snapshot → stale detection → ready/share access policy
```
No external observation bypasses human review where property-specific certainty is required. The public discovery panel is not an automatic appraisal, occupancy detection engine, or authorized listing feed.

## 3. Historical development decisions and current architecture
- Property CRUD, Excel bulk import and identity-based duplicate prevention evolved into Property Detail Hub / modular Data Room.
- DA:ON final 1-page and 7-page visual masters were explicitly approved. The user rejected repeated image-based and ad hoc PDF redesign. Preserve locked design and generate only from the agreed master/data model. Include an introductory greeting page and concluding DA:ON introduction page where the corresponding established report composition calls for them; inspect visual-master contract before changing.
- Spatial/3D model contains floor plans, PropertySpaces, media assets, links, scenes/nodes/edges, walkthrough routes/steps and verification events. GLB model/export pipeline was implemented earlier; **do not regress it**.
- Bangbae 815-11 was used for actual Data Room/provenance recovery and strict **no interior photos** rule.
- Remote Production uses dedicated Real Estate Supabase (not Sports/GPS), role/RLS boundary and Vercel; distinguish existing production deployments from E2E signoff. No destructive migrations.
- Address-first Production feature identifies address, lot, coordinates and legal-dong codes through Kakao. The remaining public provider branches remain disabled until respective keys and API service access are configured.
- Building data: BuildingHUB title, floor outline, land-use zones. Market data: MOLIT commercial/office and land transactions over candidate match classes. Usage evidence: electricity/gas, operating shops, and Kakao POI. Official land facts: VWorld land price, characteristics and land-use plan.
- Listings are `unknown / daon_exclusive / daon_active / external_observed / off_market_confirmed`. A `listingSupplyService` records source observations and pending review candidates; **no real external listing provider credentials/integration were established** at baseline.
- Report data engine handles approved Property and Data Room sources, calculates land-related values separately from official facts, enforces provenance, preserves snapshots and blocks stale ready promotion.

## 4. Data interpretation contract
| Information | Allowed wording | Forbidden inference |
| --- | --- | --- |
| Official building/land API | Recorded official source fact, subject to source date | All underlying changes guaranteed current |
| MOLIT transaction | Comparable candidate with exact/partially masked/same-dong/regional matching | Same-building confirmed transaction without identity proof |
| Land official price | Won/m², reference year; computed parcel total marked calculated | Market price, appraisal value |
| Utility consumption | Usage/energy evidence over observed months | Confirmed occupancy, tenant contract |
| Business registry / Kakao POI | Same-address or nearby activity observed | Confirmed current tenant / continuing operation |
| External listing observation | Provider-observed active/inactive candidate | Contractual mandate or off-market proof |
| Generated media | Simulated/generative | Field photograph or verified as-built |
| Missing source credential/API | Not configured, unavailable, missing | Zero transactions or no shops |

Always keep source identifiers, collection timestamp, source reference, confidence/verification status, original raw values/units, license constraints and errors. Missing providers must not wipe valid existing Property fields.

## 5. Precision and scope rules
- MOLIT sale amounts: upstream `만원`; stored/displayed normalized price in `원` = 10,000×; retain raw `sourceDealAmountTenThousandWon`, explicit source unit, KRW. Use YYYY-MM-DD dates. Verify median amount/unit price after conversion, empty/boundary values and duplicates.
- Comparable levels: `exact_lot`, `masked_address_candidate`, `same_dong_candidate`, `regional_candidate`. Even `exact_lot` is not proven same-building.
- Separate official, market, calculated, estimated, unverified and on-site-needed. Never silently mark imported records verified.
- Preserve Bangbae interiors prohibition and report master integrity.
- External listing evidence never auto-writes confirmed `listingStatus`; pending review only on high-confidence active matches.
- Partial failures are isolated by provider. Error/authorization/no data must remain distinct.
- Preserve spatial records, report history and snapshots when adding new sources.

## 6. Files and navigation
Read and inspect current code rather than treating file names as proof of live operation:
- `api/property-discovery.mjs`: provider routes, normalization and partial-failure handling.
- `src/services/publicPropertyDiscoveryService.ts`: typed discovery, sparse patch, Data Room evidence and verification candidates.
- `src/pages/PropertyDiscoveryPage.tsx` and `src/components/PropertyPublicDiscoveryPanel.tsx`: address-first UI, four information layers.
- `src/services/listingSupplyService.ts`, `src/services/marketPresenceService.ts`: observed listing versus confirmed status.
- `src/domain/propertyDataRoom/` and `src/repositories/propertyDataRoomRepository.ts`: source, verification and snapshot contracts.
- `src/services/reportEngine/reportDataBuilder.ts`, `reportSnapshotService.ts`, `reportSnapshotFreshnessService.ts`: report data and freshness rules.
- `src/domain/professionalReport/` and `docs/DAON_VISUAL_MASTER_2026-09-22.md`: template policies.
- `docs/spatial-media-walkthrough-contract-2026-10-06.md`: spatial and media policies.
- `docs/implementation-status.md`: broad earlier completion ledger; validate freshness against HEAD.

## 7. What was specifically verified 2026-10-14
1. Baseline HEAD `787aad...` included correct deal amount normalization and passed `validate:discovery / typecheck / build`.
2. `listingSupplyService.ts`, typed transaction raw unit fields, report listing-status data value and unified Discovery information layers were added on isolated work branch; the revised HEAD `4975480...` passed these same commands and was fast-forwarded.
3. Provider application checklist added and verified on HEAD `7ff56aa...`; Vercel Production deployment `dpl_FwYoc9HgitxbzmzTLCnD3ksboZQi` READY.
4. Production Bangbae 815-11 `/api/property-discovery` HTTP 200; address: `서울 서초구 방배동 815-11`, road: `서울 서초구 동광로18길 7`; Kakao same-address POI evidence observed. `publicDataConfigured=false` and `vworldConfigured=false`. No public-building, real-trade, energy, public-shop or land-price E2E claimed.
5. `validate:discovery` is a static contract check; it does not alone prove semantic unit arithmetic, real API authorization, report rendering, database verification workflow or entire production UI E2E.

## 8. Pending dependencies / practical next work
**Owner-controlled external requirements**:
- Vercel server env `DATA_GO_KR_SERVICE_KEY`, `VWORLD_API_KEY` absent at baseline; never request secrets pasted into chat.
- Official service authorizations: BuildingHUB building-register; MOLIT commercial/office transaction; MOLIT land transaction; BuildingHUB building-energy; Small Enterprise Market Agency store/business API. Confirm each currently valid exact endpoint, usage authorization and terms.
- VWorld account/service key and API domain settings, verify parcel-level response.
- Licensed/private listing provider contract, before actual feed ingestion; no scraping assumed authorized.
- Claude runner login/credential and/or connector access; Claude Pro does not automatically grant Anthropic API billing credit.

**Engineering pending verification/extension**:
1. After service activation: Bangbae 815-11 real API E2E, source-specific errors, raw-unit numeric assertions, Data Room persistence and candidate review.
2. Cross-source consistency, building/address identity, floor and legal land source verification; calculate field quality.
3. Add real listing provider adapter only with authorization and operational SLA; maintain provider-neutral schema.
4. Test end-to-end report creation, provenance, stale prevention and renderer on real approved data.
5. Regression tests for strong vs weak listing matches, no Property auto mutation, source id collisions, repeated refresh, changed observation times and existing historical snapshots. Validate API vs UI semantics.
6. Security, browser/mobile responsiveness, role-based permissions and Production acceptance. Do not overstate release readiness.

## 9. Claude collaboration/authority contract
The user wants Claude to **understand and follow the project**, not redefine the plan. Start with current HEAD, compare history and relevant docs. Claude works in a scoped task branch and submits an evidence-based change summary: goal, impacted paths, before/after, tests, risks, operational limitations and pending decisions. ChatGPT independently challenges high-risk changes when available; don't pretend the second model ran. USER owns decisions on MASTER, policy, destructive operations, privileged changes and deployment. No autonomous merge/Production push from a Claude workflow. Prefer Claude Pro-based interactive Code session if available; do not enable paid API usage without authorization. Actual linked Claude runner/Actions success is **not established by writing documents**.

## 10. Definition of done
Correct original user intent; locked design stays intact; no data loss; exact source semantics and provenance; tests PASS with evidence; changes reviewed at the appropriate risk level; production success only with actual deployment ID/READY and live checks; no false 'completed' statuses. Report blockers and next steps explicitly.

## 11. LUIN memory semantics for Claude
Maintain five tiers without conflating them: **Procedural** (how-to), **Semantic** (locked MASTER/decisions), **Episodic** (changes, incidents, commits), **Temporal State** (current state + change events), **Working Context** (active task). Never silently overwrite Semantic decisions; record conflicts, proposed changes, scope, validity, evidence and version. Cross-project LUIN principles are reusable, but Real Estate property data and business policy remain isolated.
