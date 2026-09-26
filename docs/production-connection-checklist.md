# DA:ON Production Connection Checklist

이 문서는 local-first 구현 완료 후 실제 외부 인프라를 연결할 때의 **Deployment Readiness Package**다. production Supabase/backend가 연결된 이후의 실제 배포·운영 마감 상태를 추적한다.

Latest automated validation baseline: `432ce34bbc4d07a8ade26b098e4f223e3a534012` / GitHub Actions run `36217677657` PASS
Branch: `feat/daon-master-code-lock`

## 0. 사전 원칙

- 기존 GPS Tracker / Sports-AI Supabase 프로젝트를 재사용하지 않는다.
- 부동산 전용 backend/Auth 프로젝트를 별도로 사용한다.
- 유료 리소스 생성 또는 요금제 변경은 사용자 승인 후 진행한다.
- `service_role`, `sb_secret_`, OWNER bootstrap secret, NAVER secret, Kakao REST key 등 서버 전용 secret은 브라우저 bundle에 넣지 않는다.
- 브라우저 Supabase credential은 publishable key 또는 legacy anon JWT만 사용한다.
- legacy JWT는 payload의 `role=anon`만 browser-safe로 인정하고 `role=service_role`은 거부한다.
- malformed JWT는 browser credential로 사용하지 않는다.
- 실제 backend가 연결되기 전에는 public URL, remote revoke, RLS가 동작하는 것처럼 표시하지 않는다.
- 실제 remote migration은 dry-run blocker 0, Auth/RLS/Storage 준비 완료 후에만 수행한다.
- `imported` 데이터는 사람 검증 없이 `verified`로 승격하지 않는다.

## 1. 신규 Backend 프로젝트 준비

- [x] 부동산 전용 Supabase 프로젝트 생성
- [x] 프로젝트 URL 확보
- [x] browser-safe public anon/publishable key 확보
- [ ] server-only service role/secret은 protected environment에만 저장
- [ ] production / preview 환경 분리 여부 결정
- [x] 비용/쿼터 확인
- [x] GPS/Sports 프로젝트 ID·DB·Storage·secret과 완전 분리 확인

**Gate:** 이 단계 전에는 어떤 migration도 기존 운영 프로젝트에 적용하지 않는다.

## 2. Auth + Profiles + RLS

적용 준비 파일:

- `supabase/migrations/20260916_auth_profiles_rls.sql`
- `supabase/functions/remote-auth-admin/index.ts`
- `supabase/functions/remote-auth-admin/README.md`
- `src/services/authProviderService.ts`
- `src/services/supabaseRemoteAuthGateway.ts`
- `src/services/supabaseBrowserCredential.ts`

순서:

1. Auth/profile migration을 **부동산 전용 DB에만** 적용한다.
2. `DAON_OWNER_BOOTSTRAP_KEY`를 최소 32자의 server-only secret으로 설정한다.
3. `AUTH_ADMIN_ALLOWED_ORIGINS`에 production frontend origin만 등록한다.
4. `remote-auth-admin` Edge Function을 JWT 검증이 유지되는 상태로 배포한다.
5. 첫 Auth 사용자를 생성하고 로그인한다.
6. 잘못된 bootstrap key가 거부되는지 확인한다.
7. 올바른 bootstrap key + authenticated session으로 최초 1명만 OWNER로 승격한다.
8. 두 번째 bootstrap 시도가 거부되는지 확인한다.
9. 최초 OWNER 생성 직후 bootstrap secret을 rotate/remove한다.
10. 신규 사용자가 기본 `viewer`인지 확인한다.
11. OWNER / ADMIN / EDITOR / VIEWER 권한 회귀검증을 수행한다.
12. 마지막 active OWNER 강등·비활성화 차단을 확인한다.
13. multi-device에서 동일 profile/role을 확인한다.

브라우저 adapter 주입 규칙:

- production provider는 `SupabaseRemoteAuthGateway`에 연결되어 있다.
- project URL + browser-safe publishable key만 브라우저에 주입한다.
- 기본 token store는 memory-only다.
- persistent session store는 별도 검토 후 명시적으로 주입한다.
- owner 관리 action은 browser가 DB를 직접 수정하지 않고 `remote-auth-admin` Edge Function만 호출한다.

완료 조건:

- [x] `REMOTE AUTH = CONNECTED`
- [ ] 실제 로그인 session 존재
- [ ] profile role/is_active 서버 조회 동작
- [ ] OWNER-only user administration 강제
- [ ] self-promotion 차단
- [ ] inactive user 차단
- [ ] last-active-owner continuity protection PASS
- [ ] multi-device session/profile PASS

## 3. Property/Data + Private Storage

적용 준비 파일:

- `supabase/migrations/20260916_property_data_rls.sql`
- `supabase/migrations/20260916_property_asset_storage.sql`
- `src/services/remoteDataGateway.ts`
- `src/services/supabaseRemoteDataGateway.ts`
- `src/services/supabaseBrowserCredential.ts`

적용 순서:

1. Auth/profile migration 완료 확인
2. Property/Data schema + RLS migration 적용
3. private asset Storage migration 적용
4. `daon-property-assets` bucket이 `public=false`인지 확인
5. browser Auth adapter에서 access token / actor id 공급
6. Supabase REST/Storage adapter를 명시 주입
7. 아직 local authoritative 상태를 유지하고 remote write는 실행하지 않음
8. Migration Readiness 화면에서 dry-run 재실행
9. blocker 0 확인
10. 최소 1개 테스트 물건만 controlled migration
11. second-device read/write E2E
12. local/remote record count reconciliation
13. 역할별 RLS negative/positive test

RLS 필수 테스트:

- [ ] VIEWER read 허용 / write·delete 차단
- [ ] EDITOR property/data CRUD 허용 / property delete 차단
- [ ] EDITOR verification approval 차단
- [ ] EDITOR final report snapshot 차단
- [ ] ADMIN verification/final report 허용
- [ ] ADMIN property delete/company settings write 차단
- [ ] OWNER property delete/company settings write 허용
- [ ] anon operational table access 차단

Storage 필수 테스트:

- [ ] private bucket public 직접 접근 차단
- [ ] authenticated read 동작
- [ ] OWNER/ADMIN/EDITOR upload/update/delete 동작
- [ ] VIEWER write 차단
- [ ] 50 MiB hard cap 강제
- [ ] path traversal 차단
- [ ] Blob/base64/data URL을 DB metadata에 직접 저장하지 않음

## 4. Remote Migration Controlled Execution

현재 구현된 Migration Readiness / dry-run은 **network write = 0**으로 고정되어 있다.

실제 migration 실행 전 필수:

- [ ] 최신 Local Backup 생성
- [ ] restore rehearsal 최소 1회 PASS
- [ ] dry-run Manifest 재생성
- [ ] Handoff Bundle 재생성
- [ ] blocker count = 0
- [ ] orphan property reference = 0
- [ ] missing binary / unsupported store = 0
- [ ] inline binary/data URL blocker = 0
- [ ] Auth CONNECTED
- [ ] RLS/Storage 실제 적용 완료
- [x] 테스트 사용자 role matrix PASS

실행 정책:

1. 테스트 물건 1개
2. Property 본체
3. modular object
4. verification candidate/history
5. report snapshot
6. asset metadata
7. private Storage binary
8. remote read-back
9. local/remote reconciliation
10. second-device 확인

위 순서가 PASS하기 전 전체 물건 migration을 실행하지 않는다.

2026-09-18 production QA controlled migration E2E:
- [x] 테스트 Property 1건 write/read-back
- [x] modular object 1건 write/read-back
- [x] imported provenance 유지 / verified 자동승격 없음
- [x] remote count reconciliation PASS
- [x] 독립 DB session A → B → A persistence round trip PASS
- [x] 검증 후 QA migration 데이터 전량 삭제 및 baseline count 복구

## 5. Remote / Public External Share

적용 준비 파일:

- `supabase/migrations/20260915_external_public_share.sql`
- `supabase/functions/remote-public-share/index.ts`
- `supabase/functions/remote-public-share/README.md`
- `src/services/remoteExternalShareGateway.ts`
- `src/services/externalShareProviderService.ts`

배포 조건:

- Auth/profile migration 선행
- `PUBLIC_SHARE_BASE_URL`은 선택사항이며 미설정 시 Edge Function self-hosted viewer 사용
- cross-origin production frontend 사용 시 `PUBLIC_SHARE_ALLOWED_ORIGINS` exact allowlist 설정
- management action은 authenticated OWNER/ADMIN만 허용
- anonymous resolve/review는 raw token server validation만 허용
- table direct anon access 금지

보안 조건:

- raw token DB 저장 금지
- SHA-256 token hash만 저장
- raw token은 발급 시점에만 반환
- audit/list 응답에 raw token/public URL 재구성 정보 비노출
- public URL token은 URL fragment 사용
- expiry / revoke / allow_download 서버 강제
- Release Snapshot canonical/checksum/signature 검증 후에만 issue
- tampered snapshot issue 차단

완료 조건:

- [ ] 실제 public URL 발급
- [ ] valid signed snapshot resolve
- [ ] tampered snapshot issue 차단
- [x] expiry 후 접근 차단 — production HTTP 410 `expired`
- [x] revoke 즉시 외부 접근 차단 — production HTTP 410 `revoked`
- [x] download policy 강제 — resolve 응답 `allowDownload=false` 확인
- [x] review note 서버 동기화 — production HTTP 201 + DB row 1 확인
- [x] raw token DB/audit 비노출 — raw match 0 / SHA-256 hash match 1

추가 acceptance:
- [x] anonymous invalid token 404
- [x] unauthenticated revoke 401 `authentication_required`
- [x] revoked token review write 410 차단
- [x] self-hosted viewer HTTP 200 + READ ONLY + noindex 확인
- [ ] real OWNER JWT로 `issue/list/revoke` management path 최종 acceptance
- [ ] real OWNER JWT로 signed snapshot issue / tampered snapshot rejection 네트워크 acceptance

## 6. Spreadsheet Import Security

현재 기준:

- `xlsx` locked version = `0.20.3`
- CVE-2023-30533 fixed-version floor = `0.19.3`
- CVE-2024-22363 fixed-version floor = `0.20.2`
- parser input size limit = 10 MiB
- XLSX/ZIP 및 XLS/OLE 실제 file signature 검증
- formula / HTML / VBA / dependency / embedded-file parsing 비활성화
- CI `Validate Excel import security boundary` PASS

Production release 직전 필수:

- [x] `package-lock.json` 실제 locked version 확인 — `0.20.3`
- [x] SheetJS/vendor/GitHub advisory 재검토 — 2026-09-18
- [x] `node scripts/validate-excel-security.mjs` PASS — GitHub Actions #818
- [ ] 정상 `.xlsx` import 회귀검증
- [ ] legacy `.xls` import 회귀검증
- [ ] 비스프레드시트 rename 공격이 parser 전에 거부되는지 확인
- [ ] 중복/검증후보/숫자/날짜 파싱 회귀검증
- [x] `npm audit` 결과와 별개로 CDN tarball advisory 수동 확인 — 2026-09-18

현재 readiness 상태는 `PATCHED_PINNED_REVIEW_AT_RELEASE`가 정상이다. 새 advisory가 locked version에 영향을 주면 Production READY를 중단한다.

## 7. Production Frontend / Protected Proxy

현재 개발 구조:

- frontend `5174`
- local proxy `5175`

Production 준비:

- [ ] frontend host 결정
- [ ] protected serverless/backend proxy 결정
- [ ] `/api/maps/geocode`
- [ ] `/api/maps/static`
- [ ] `/api/poi/search`
- [ ] server secret provisioning
- [ ] browser bundle/source map secret scan
- [ ] CORS / exact origin 제한
- [ ] rate limit / abuse guard 검토

Browser-safe:

- Supabase project URL
- Supabase publishable/public anon key
- Kakao JavaScript SDK key — 도메인 제한 필수

Server-only:

- NAVER_MAP_CLIENT_ID
- NAVER_MAP_CLIENT_SECRET
- KAKAO_REST_API_KEY
- Supabase service_role / `sb_secret_`
- DAON_OWNER_BOOTSTRAP_KEY
- external-share server secrets

## 8. Provider Domain Allowlist

- [ ] NAVER production domain 등록
- [ ] Kakao production domain 등록
- [ ] Kakao JavaScript SDK origin 확인
- [ ] Supabase Auth Site URL / Redirect URL 등록
- [ ] Auth/Public Share exact CORS origin 등록
- [ ] localhost와 production 도메인 분리 확인

## 9. Production E2E

필수 시나리오:

1. OWNER 로그인
2. wrong bootstrap 거부 / 최초 OWNER bootstrap / second bootstrap 거부
3. OWNER 사용자 초대/role/status 관리
4. 물건 생성/수정
5. Excel 표준양식 다운로드 및 import
6. Data Room 문서/미디어 private Storage 업로드
7. Verification 생성/승인 role test
8. Report Snapshot draft/final role test
9. local → remote → second-device persistence round trip
10. 1P/7P MASTER render/print/PDF
11. signed REMOTE/PUBLIC share 생성
12. 익명 recipient resolve
13. tampered snapshot issue 차단
14. expiry 테스트
15. remote revoke 테스트
16. review note 동기화
17. NAVER geocode/static + Kakao POI/Roadview
18. backup export + restore rehearsal
19. browser secret scan
20. local/remote record count reconciliation

## 10. 배포 승인 Gate

다음이 모두 충족되어야 Production READY로 본다.

- [x] Dedicated real-estate backend confirmed
- [x] REMOTE AUTH CONNECTED
- [x] Property/Data RLS 실제 적용 및 role test PASS
- [x] Private Storage schema/policy PASS
- [x] Controlled migration + reconciliation PASS (production QA controlled migration)
- [x] Independent-session persistence PASS (DB-session equivalent; physical second-device browser acceptance remains)
- [x] REMOTE / PUBLIC CONNECTED
- [ ] Production frontend host LIVE
- [ ] Protected backend proxy LIVE
- [ ] Provider/domain allowlist 완료
- [x] Spreadsheet release advisory review PASS — 2026-09-18: SheetJS CE 0.20.3 current recommended; known CVE-2023-30533/CVE-2024-22363 fix floors satisfied
- [ ] Excel import regression PASS
- [ ] server secret browser 미노출 확인
- [x] Typecheck PASS — GitHub Actions #818
- [x] Lint PASS — GitHub Actions #818
- [x] Build PASS — GitHub Actions #818
- [x] GitHub Actions 전체 PASS — run `36217677657` (`432ce34bbc4d07a8ade26b098e4f223e3a534012`)
- [ ] Production E2E PASS

## 현재 상태 확인

```bash
npm run readiness:prod
```

현재 상태:

- LOCAL POLICY = READY
- REMOTE AUTH server + browser adapter = CONNECTED
- Property/Data schema + RLS = APPLIED
- Private Storage boundary = APPLIED
- REMOTE DATA adapter = CONNECTED
- REMOTE / PUBLIC server + self-hosted viewer = CONNECTED
- QA OWNER/EDITOR/VIEWER RLS E2E = PASS
- real operator OWNER account = REQUIRED
- independent-session persistence E2E = PASS
- actual second-device browser acceptance = REQUIRED
- production frontend/proxy = MISSING EXTERNAL INFRA
- provider/domain allowlist = CHECK REQUIRED
- Supabase Auth leaked-password protection = DISABLED CONFIRMED 2026-09-26 / MANUAL ENABLE REQUIRED
- spreadsheet parser = PATCHED_PINNED_REVIEW_AT_RELEASE

서버 연결 완료와 실사용 운영 마감은 구분한다. 운영 계정·second-device·도메인·proxy 검증 후 최종 Production READY로 승격한다.
## Production runtime package

- production runtime package = READY_TO_DEPLOY
- `npm run start:prod`는 `server/frontend.mjs` + `server/proxy.mjs`를 함께 실행한다.
- production frontend host/domain/TLS는 여전히 외부 인프라에서 연결해야 한다.
- `VITE_API_BASE_URL`이 비어 있으면 same-origin `/api`, 분리 배포 시 HTTPS origin만 허용한다.
- `MAP_PROXY_ALLOWED_ORIGINS` wildcard `*` 사용 금지, exact origin allowlist만 허용한다.
- 실제 host 연결 후 `/healthz`, `/api/status`, NAVER geocode/static, Kakao POI를 production domain에서 검증한다.

## External production HTTP acceptance

- 실제 host 연결 후 `DAON_PRODUCTION_BASE_URL=https://...`과 필요 시 `DAON_PRODUCTION_API_BASE_URL=https://...`을 설정하고 `npm run test:prod-http` 실행
- production URL 미설정 상태를 PASS 처리하지 않는다.
- HTTPS, `/healthz`, SPA fallback, 보안 헤더, `/api/status`, server-secret 비노출을 확인한다.


## 2026-09-26 Production read-only cutover recheck

Production project: `real-estate-report-production`

Read-only verification result:

- properties = 2
- Bangbae `daon-bangbae-815-11` = 0
- property_assets = 0
- property_verifications = 0
- report_snapshots = 0
- external_share_sessions = 0
- profiles = QA Owner 1 / QA Editor 1 / QA Viewer 1
- real operator OWNER = not present
- private bucket `daon-property-assets` = public false / 50 MiB cap
- Supabase Security Advisor = Leaked Password Protection Disabled
- no Production write was executed

Current cutover state:

`PLATFORM COMPLETE / PRODUCTION CUTOVER PENDING`

Blocking external inputs remain:
1. land-register original
2. optional cadastral-map original for completeness
3. authorized raw binary for confirmed official PDFs
4. at least one real direct exterior/road/neighborhood image binary
5. real operator OWNER acceptance
6. production host/domain/TLS and provider allowlists
7. Leaked Password Protection enablement
8. Bangbae-only dry-run blocker = 0 before any migration
