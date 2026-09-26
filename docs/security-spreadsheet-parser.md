# Spreadsheet Parser Security Decision

Status: PATCHED VERSION PINNED / RELEASE ADVISORY REVIEW COMPLETED 2026-09-27

## Current dependency

- Package name: `xlsx`
- Distribution: official SheetJS CE CDN tarball
- Locked version: `0.20.3`
- Spec: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`

The project reads user-supplied `.xlsx` / `.xls` files, so spreadsheet parser vulnerabilities are reachable and cannot be treated as export-only risk.

## Known advisories addressed by current version

- CVE-2023-30533 / GHSA-4r6h-8v6p-xvw6 — prototype pollution. Affected SheetJS CE versions are below 0.19.3.
- CVE-2024-22363 / GHSA-5pgg-2g8v-p4x9 — ReDoS. Affected SheetJS CE versions are below 0.20.2.

The currently pinned 0.20.3 is above both published fixed-version floors.

Reference URLs for release review:
- https://github.com/advisories/GHSA-4r6h-8v6p-xvw6
- https://github.com/advisories/GHSA-5pgg-2g8v-p4x9
- https://cdn.sheetjs.com/

## 2026-09-27 release advisory review

Release review completed against the current official SheetJS installation/security guidance and the current advisory/scanner state.

Findings:

- the project lock still resolves to SheetJS CE `0.20.3` from the official SheetJS CDN tarball;
- CVE-2023-30533 is documented as fixed in 0.19.3 or later;
- CVE-2024-22363 is documented as fixed in 0.20.2 or later;
- the pinned `0.20.3` therefore remains above both published fixed-version floors;
- current SheetJS documentation still recommends the official CDN distribution path for modern CE releases;
- a September 2026 OSV-Scanner issue documents false-positive matching for the CDN-resolved 0.20.3 package against historical GHSA ranges;
- no newly identified parser advisory was found in this release review that establishes `0.20.3` as affected.

Decision:

- **no spreadsheet-parser release blocker identified for this release baseline**;
- keep `0.20.3` pinned;
- keep the 10 MiB limit, signature gate, and parser hardening unchanged;
- repeat this advisory review at every Production release and immediately if a new SheetJS parser advisory is published.

Evidence reviewed:

- SheetJS installation / bundler guidance
- SheetJS security guidance
- SheetJS / GitHub vulnerability discussion for 0.20.3
- Google OSV-Scanner issue #3073 documenting CDN-resolved 0.20.3 advisory-range misclassification

This review does not waive future advisories and does not claim the absence of unknown vulnerabilities.

## Runtime hardening

`src/utils/excel.ts` must keep all of the following:

- maximum import size = 10 MiB
- actual file signature check before `XLSX.read()`
  - XLSX/ZIP signatures: `PK\x03\x04`, `PK\x05\x06`, `PK\x07\x08`
  - legacy XLS/OLE signature: `D0 CF 11 E0 A1 B1 1A E1`
- `cellFormula: false`
- `cellHTML: false`
- `bookVBA: false`
- `bookDeps: false`
- `bookFiles: false`
- all import paths must pass through the same hardened reader

Browser `<input accept>` is not a security boundary. A renamed arbitrary file must be rejected before the parser is invoked.

## Dependency policy

CI must fail if:

- the locked `xlsx` version is missing;
- the locked version is below `0.20.2`;
- the dependency changes away from the reviewed official SheetJS CDN spec without an explicit security review;
- parser hardening markers or file-signature validation disappear.

`npm audit` is supplementary only for this dependency because the patched community build is distributed as a CDN tarball rather than the historical npm registry release.

## Release gate

Before declaring Production READY:

1. confirm the lock still resolves to 0.20.3 or a newer explicitly reviewed version;
2. re-check the SheetJS/GitHub advisory sources for new parser advisories;
3. verify CI still passes the Excel security validator;
4. exercise benign `.xlsx` and legacy `.xls` imports;
5. exercise rejection of a non-spreadsheet file renamed to `.xlsx`;
6. do not waive a newly published parser advisory solely because `npm audit` reports zero findings.

This decision does not assert that no unknown vulnerabilities exist. It records the known-advisory baseline and the required release-review process.
