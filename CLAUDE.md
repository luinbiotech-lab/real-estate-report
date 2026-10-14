# CLAUDE.md — DA:ON Real Estate Professional Report

> Read this file FIRST, then `docs/CLAUDE_PROJECT_HANDOFF_2026-10-14.md`, `docs/implementation-status.md`, and the relevant system contracts BEFORE changing code.
> The repository and code are ground truth for implementation; this guide preserves user intent and locked policy. If any apparent conflict exists, report it. Never silently supersede a locked decision.

## Identity and mission
This is the **DA:ON Real Estate Professional Report platform** in `luinbiotech-lab/real-estate-report`, primary working branch `feat/daon-master-code-lock`.
Mission: create a reliable, verifiable Property → Data Room → evidence/provenance → human verification → structured intelligence → professional 1P/7P reports → versioned snapshots → authorized distribution pipeline. Longer-term commercial goal: a reusable data/AI operating platform, not a one-off PDF, with interoperable schemas, quality controls, audit history, possible B2B subscriptions and repeatable report production.

## Mandatory constraints (LOCKED)
- Do NOT redesign `DAON_1P_MASTER` or `DAON_DETAIL_7P_MASTER`. Existing visual masters are approved and must not be replaced with generic PDFs, generated images, or altered templates. Consult `docs/DAON_VISUAL_MASTER_2026-09-22.md`.
- No destructive Production changes; never delete/rewrite customer data, migrations, RLS, media or snapshots without explicit approval and rollback planning.
- **Bangbae-dong 815-11**: no interior photography. Retain the property-specific media policy. Real exterior/road/surroundings evidence only, with provenance. No synthetic visual as actual field photograph.
- Real vs sample/test vs calculated vs estimated vs AI inference vs needs-on-site-verification MUST remain distinguishable. Never fabricate data or label missing provider data as confirmed.
- A public transaction row is a **candidate**, never a confirmed same-building sale simply because an address/lot seems similar. Preserve `exact_lot / masked_address_candidate / same_dong_candidate / regional_candidate`.
- Energy usage, Kakao POI and operating-shop listings support *activity evidence*, NOT confirmed occupancy/tenancy.
- External listings do not automatically prove owner authorization, exclusive mandates, current on-market status or off-market status.
- Maintain stale snapshot blocking, original raw value/unit preservation, provenance and human verification. Never promote imported evidence to verified by automation alone.
- Preserve the 3D/Viewer/Walkthrough/GLB pipeline and existing remote/local modes.
- Never expose server-only secrets (DATA_GO_KR_SERVICE_KEY, VWORLD_API_KEY, Kakao REST, Supabase service role) in browser bundles, logs or commits.

## Current verified technical baseline (2026-10-14)
- Last independently verified release baseline at onboarding: `7ff56aa624cdbbe0641acca99bcea24f383e95da`; Production deployment `dpl_FwYoc9HgitxbzmzTLCnD3ksboZQi` was READY. **Always re-check HEAD and Production before new work**; this line is historical, not a permanent latest claim.
- `npm run validate:discovery`, `npm run typecheck`, `npm run build` passed in Vercel Sandbox on that baseline; build has chunk-size warnings only.
- Public discovery: Kakao address/coordinate/legal-dong ID works in Production; BuildingHUB, transaction, energy, business discovery are implemented but `DATA_GO_KR_SERVICE_KEY` missing in Vercel; VWorld land information requires `VWORLD_API_KEY`, also missing at baseline. A **key exists** is not enough: each specific API must be authorized and verified with real responses.
- MOLIT `dealAmount` is supplied in **10,000 KRW units**, normalized `dealAmount` must be KRW (`× 10000`); retain `sourceDealAmountTenThousandWon`, `dealAmountSourceUnit = '만원'`, `currency = 'KRW'`. Dates are YYYY-MM-DD. Test boundary values.
- Existing property lookup, non-destructive discovery refresh, Data Room source records and verification candidates already exist.
- VWorld land price/land characteristic/land-use modules, property hub, and report data provenance are already implemented at contract level, pending live key.
- Normalized `src/services/listingSupplyService.ts` exists. It stores observational evidence and creates pending candidate only for strong active matches; does not automatically mutate `Property.listingStatus`.
- Discovery has four information layers: official fact / market observations / activity evidence / listing state. `ReportDataBuilder` carries approved Property listing state into new report view models; snapshot freshness gate remains intact.
- Do NOT claim real public API E2E, real listing provider integration, or browser Report E2E as completed without actual proof.

## Mandatory start-of-task routine
1. Establish **goal → user intent → locked decisions → current HEAD → already complete → incomplete → risks → execution → verification → done criteria**.
2. Read `git status`, branch HEAD, recent commits, relevant files and existing test scripts. Do not blindly trust prior descriptions; distinguish verified vs inherited claims.
3. Choose smallest non-destructive patch, with a separate work branch for substantive changes. No replace-the-entire-project or unnecessary migrations.
4. Validate scope, dependencies, impacted flows, and secret/licensing constraints.
5. Implement, run necessary checks, report actual PASS/FAIL/NOT_TESTED and exact commit/branch/deployment evidence. CI green alone is not live data E2E.
6. Retain a concise handoff: files changed, reasoning, known exceptions, pending owner actions, next priorities.

## Multi-AI collaboration operating model
- Claude may inspect, propose, implement, test and review **only within explicitly assigned scope**; **not autonomous owner**. User is final authority over product/MASTER/production-sensitive decisions.
- ChatGPT/OpenAI acts as separate challenger/reviewer where available, not a simulated review. State explicitly if this independent check was not run (e.g., expired API credit).
- Standard: scoped task → Claude changes on work branch → automated checks → independent review for high-risk/nontrivial changes → corrective cycle → user-approved merge/deploy.
- Do not claim live Claude execution merely because this file exists. Claude Code/Action requires an actual runner login/token and a successful workflow run.
- No automatic PR merge or Production deployment by the Claude workflow. Avoid API spend if Claude Pro interactive login is the only authorized channel; do not silently enable paid API calls.
- Protected areas: report masters, auth/RLS, destructive database changes, secret/config operations, Production, property-specific media policy, user-facing verified assertions. Escalate conflicts and high-risk actions.
- Keep LUIN five memory layers conceptually distinct: Procedural, Semantic, Episodic, Temporal State, Working Context. Version important decisions; never silently rewrite approved Semantic state.

## Developer commands and handoff
```bash
npm ci
npm run validate:masters
npm run validate:pipeline
npm run validate:discovery
npm run typecheck
npm run build
```
Run additional repo validation scripts and CI suites for impacted modules. Treat failed checks as blockers, not as permission to delete working features.
Detailed status, endpoints, dependencies and next tasks: `docs/CLAUDE_PROJECT_HANDOFF_2026-10-14.md`.
