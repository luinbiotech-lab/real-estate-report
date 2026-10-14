# DA:ON Real Estate Agent — Project-local control plane

**Status: BOOTSTRAPPED / NOT YET EXECUTING.** This is the authoritative home of the real-estate-specific agent contract. It is NOT an operational Claude session.

## Architecture boundary
- This repository (`real-estate-report`) owns DA:ON agent mission, project-specific policies, backlog and implementation.
- `luin-agentic-ai` is shared **execution infrastructure** only (task ledger, model routing, independent review, CI workers). It must not become the central repository for every project's business-specific agent.
- Other product agents belong to their respective product repositories or dedicated agent repositories when justified.
- The shared engine must treat `da-real-estate` as an externally registered client of the runtime, not a product developed in the runtime repo.

## Roles and authorization
- Owner: all business decisions, permission, production merge and deploy authorization.
- Claude Code: scoped executor, only on task branch and allowed files; no self-approval.
- OpenAI: independent reviewer on the exact commit SHA; fail closed if unavailable.
- GitHub Actions: CI and durable evidence. No deployment or migration through agent tasks without distinct owner authorization.
- Read `CLAUDE.md`, `docs/CLAUDE_PROJECT_HANDOFF_2026-10-14.md`, `docs/DAON_VISUAL_MASTER_2026-09-22.md`, and `docs/spatial-media-walkthrough-contract-2026-10-06.md` before executing.

## Hard restrictions
- Do not overwrite approved DAON 1P/7P report designs.
- Do not alter Production, Supabase operational data/migrations, secrets, or deploy by default.
- Preserve source evidence, provenance, MOLIT units, confidence boundaries and project cost ceilings.
- Implementation -> exact-SHA CI -> independent AI review -> owner approval.
- Persistent Task `T-6ee3cc1e626acdbd` was transferred to shared ledger for audit only. It remains REQUESTED, with no Claude implementation run. Do not claim Claude has been invoked.

## First acceptance exercise
Scoped executable MOLIT amount-normalization regression assertions only in `api/property-discovery.mjs` and `scripts/validate-public-property-discovery.mjs`. Verify `npm run validate:discovery`, `npm run typecheck`, `npm run build`. Do not merge/deploy.

## Claude independent architecture consultation — pending
Requested by project owner. The Claude API worker has not been dispatched: authentication must be configured and verified. Record a real run/session ID before attributing conclusions to Claude.
