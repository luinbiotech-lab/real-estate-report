# DA:ON Real Estate Platform — Production Connection Runbook

이 문서는 local-first 기준선을 실제 부동산 전용 운영환경으로 승격할 때의 연결 순서를 고정한다. 현재 repository의 LOCAL POLICY / LOCAL-OFFLINE 기능을 실제 Auth/RLS, REMOTE/PUBLIC 공유, production hosting으로 전환할 때만 사용한다.

## 0. 절대 금지

- 기존 GPS Tracker 또는 Sports AI Supabase 프로젝트를 재사용하지 않는다.
- `service_role` key, NAVER client secret, KAKAO REST key를 browser bundle에 넣지 않는다.
- Auth backend가 없는데 로그인/RLS가 강제되는 것처럼 표시하지 않는다.
- REMOTE/PUBLIC backend가 없는데 public URL, remote revoke, server expiry가 가능한 것처럼 표시하지 않는다.
- raw external-share token을 DB에 저장하지 않는다. 서버에서 hash 후 `token_hash`만 저장한다.
- 실데이터를 사람 검증 없이 `verified`로 승격하지 않는다.

## 1. Dedicated backend provision

1. 부동산 전용 Supabase/backend 프로젝트를 새로 만든다.
2. project URL / public anon key / server-only service role credential을 분리한다.
3. service role credential은 server/Edge Function 환경에만 저장한다.
4. production 도메인과 redirect URL을 Auth provider에 등록한다.
5. GPS/Sports 프로젝트와 project id, DB, storage, secret을 공유하지 않는다.

완료 조건: dedicated real-estate project 식별자가 별도로 존재하고, 다른 프로젝트의 credential을 사용하지 않는다.

## 2. Auth / profile / role bootstrap

준비된 코드:

- `supabase/migrations/20260916_auth_profiles_rls.sql`
- `supabase/functions/remote-auth-admin/index.ts`
- `supabase/functions/remote-auth-admin/README.md`

현재 상태는 **PREPARED / NOT DEPLOYED**이다. 실제 부동산 전용 Supabase가 준비되기 전에는 `REMOTE AUTH`를 READY로 표시하지 않는다.

배포 순서:

1. Auth/profile migration을 부동산 전용 backend에만 적용한다.
2. `DAON_OWNER_BOOTSTRAP_KEY`를 32자 이상의 server-only secret으로 설정한다.
3. `AUTH_ADMIN_ALLOWED_ORIGINS`에 production frontend origin만 등록한다.
4. `supabase functions deploy remote-auth-admin`으로 배포한다. 이 함수에는 `--no-verify-jwt`를 사용하지 않는다.
5. 첫 Auth 사용자를 생성하고 로그인한다.
6. 잘못된 bootstrap key가 거부되는지 확인한다.
7. 올바른 bootstrap key + authenticated session으로 최초 1명만 `owner`로 승격한다.
8. 두 번째 bootstrap 시도가 `bootstrap_already_completed`로 거부되는지 확인한다.
9. 최초 OWNER 생성 후 `DAON_OWNER_BOOTSTRAP_KEY`를 즉시 rotate/remove한다.
10. 신규 사용자가 기본 `viewer`로 생성되는지 확인한다.
11. anon 사용자가 `public.profiles`를 읽을 수 없는지 확인한다.

운영 규칙:

- `invite_user`, `update_role`, `set_active`, `list_profiles`는 active OWNER만 실행한다.
- browser에서 자기 role을 임의 변경할 수 있는 경로를 만들지 않는다.
- 마지막 active OWNER는 강등하거나 비활성화할 수 없다.
- `service_role`과 bootstrap secret은 browser bundle/localStorage/sessionStorage에 넣지 않는다.
- CORS는 `AUTH_ADMIN_ALLOWED_ORIGINS` exact allowlist를 사용하며 wildcard origin을 사용하지 않는다.

완료 조건:

- authenticated session 동작
- profile persistence 동작
- one-time OWNER bootstrap 동작
- owner-only user administration 동작
- last-active-owner continuity protection 동작
- inactive profile 차단 정책 확인
- multi-device에서 동일 profile/role 확인

## 3. Property/Data persistence + RLS

준비된 코드:

- `supabase/migrations/20260916_property_data_rls.sql`
- `supabase/migrations/20260916_property_asset_storage.sql`
- `src/services/remoteDataGateway.ts`

현재 상태는 **PREPARED / NOT APPLIED / NOT CONNECTED**이다. 실제 backend에 적용하기 전까지 local IndexedDB가 authoritative operational store다.

적용 순서:

1. `20260916_auth_profiles_rls.sql`
2. `20260916_property_data_rls.sql`
3. `20260916_property_asset_storage.sql`
4. frontend Remote Data Gateway 실제 provider 연결
5. 최소 1개 테스트 물건으로 local → remote migration rehearsal
6. cross-device read/write E2E 후에만 REMOTE DATA를 READY로 승격

서버 데이터 구조:

- `properties`: Property 본체 JSON snapshot + audit actor
- `property_objects`: 문서/미디어/3D binary를 제외한 모듈형 Data Room / Agent / Spatial / Risk 데이터
- `property_verification_candidates`: 검증 후보와 승인상태
- `property_verifications`: 검증 확정 이력
- `report_snapshots`: immutable draft/final snapshot
- `company_settings`: 회사/브랜드 설정
- `property_assets`: 문서/미디어/Digital Twin binary metadata + private Storage path
- private bucket `daon-property-assets`: 실제 binary object

역할별 서버 강제:

- VIEWER: active profile이면 read-only
- EDITOR: Property/Data object 수정·업로드, verification candidate 제출, report draft 생성
- ADMIN: EDITOR 권한 + 검증 확정 + final report 생성
- OWNER: 전체 권한 + Property 삭제 + company settings 변경
- verification 확정은 OWNER/ADMIN만 가능
- report snapshot은 immutable이며 UPDATE policy를 만들지 않는다.
- 마지막 권한판정은 browser UI가 아니라 RLS가 강제한다.

Binary asset 경계:

- `PropertyDocument`, `PropertyMedia`, `DigitalTwinAsset`의 Blob/base64/data URL은 DB JSONB에 저장하지 않는다.
- DB에는 metadata + `storage_path`만 저장한다.
- Storage bucket은 `public=false`로 유지한다.
- bucket/object SELECT는 active authenticated user만 허용한다.
- upload/update/delete는 OWNER/ADMIN/EDITOR만 허용한다.
- server hard cap은 50 MiB이며 현재 browser validation이 더 엄격하면 browser 제한을 우선한다.
- Storage path는 `<propertyId>/<resourceType>/<resourceId>/<sanitizedFileName>` 계약을 유지한다.

완료 조건:

- VIEWER write/delete 차단
- EDITOR property/data CRUD 허용, property delete 차단
- EDITOR verification approval 차단
- EDITOR final report snapshot 생성 차단
- ADMIN verification/final report 허용, property delete/company settings write 차단
- OWNER property delete/company settings write 허용
- anon operational table access 차단
- private asset URL 직접 public 노출 차단
- Blob/base64/data URL metadata 저장 차단
- local → remote → second-device round trip E2E

## 4. REMOTE / PUBLIC external share

준비된 코드:

- `supabase/migrations/20260915_external_public_share.sql`
- `supabase/functions/remote-public-share/index.ts`
- `supabase/functions/remote-public-share/README.md`

현재 상태는 **PREPARED / NOT DEPLOYED**이다. 실제 부동산 전용 Supabase가 준비되기 전에는 `REMOTE / PUBLIC`을 READY로 표시하지 않는다.

배포 순서:

1. Auth/profile migration을 먼저 적용한다.
2. external-share migration을 적용한다.
3. `PUBLIC_SHARE_BASE_URL`, `PUBLIC_SHARE_ALLOWED_ORIGINS`를 서버 secret/environment로 설정한다.
4. `supabase functions deploy remote-public-share --no-verify-jwt`로 배포한다.
5. 관리 action(`issue`, `revoke`, `list`)이 함수 내부 `auth.getUser()` + active `owner/admin` 검증을 통과하는지 확인한다.
6. 익명 action(`resolve`, `add_review`)은 raw token 검증으로만 접근되며 table 직접 anon access는 계속 금지한다.

서버/Edge Function에서 반드시 수행:

1. 충분한 entropy의 32-byte raw token을 issuance 시점에만 생성한다.
2. raw token을 SHA-256으로 hash하여 `token_hash`만 DB에 저장한다.
3. public URL에는 raw token을 query/path가 아니라 URL fragment `#token=...`으로 1회 전달한다.
4. 감사/list 응답에는 raw token 및 재구성 가능한 public URL을 반환하지 않는다.
5. 조회 시 presented token을 서버에서 hash하여 session을 resolve한다.
6. `revoked_at`, `expires_at`, `read_only`, `allow_download`를 서버에서 검사한다.
7. public client가 `external_share_sessions` 테이블을 직접 조회하지 못하게 유지한다.
8. review-note write도 동일 token validation을 통과한 경우에만 허용한다.
9. Release Snapshot 발급 전 `schemaVersion`, `immutable`, canonical package, SHA-256 checksum, ECDSA P-256/SHA-256 signature를 서버에서 검증한다.
10. tampered snapshot, checksum mismatch, invalid signature는 issuance 전에 거부한다.
11. browser CORS는 `PUBLIC_SHARE_ALLOWED_ORIGINS` exact allowlist를 사용하고 wildcard origin을 사용하지 않는다.

완료 조건:

- valid signed snapshot public URL 발급
- tampered snapshot 발급 차단
- 만료 후 접근 차단
- revoke 후 즉시 접근 차단
- download policy 강제
- remote review sync
- raw token DB 비저장 확인
- list/audit 응답 raw token 비노출

## 5. Frontend / protected proxy production deployment

현재 개발 구조:

- frontend: Vite, local port 5174
- protected map/POI proxy: local port 5175

production에서는 다음을 분리한다.

### Browser-safe

- Supabase project URL
- public anon key
- Kakao JavaScript SDK key (도메인 제한 필수)

### Server-only

- `NAVER_MAP_CLIENT_ID`
- `NAVER_MAP_CLIENT_SECRET`
- `KAKAO_REST_API_KEY`
- Supabase `service_role`
- `DAON_OWNER_BOOTSTRAP_KEY`
- external-share token-management server secrets

proxy 승격 대상 route:

- `/api/maps/geocode`
- `/api/maps/static`
- `/api/poi/search`

완료 조건: browser bundle/HTML/source map에서 server-only credential이 검출되지 않는다.

## 6. Provider/domain allowlist

production URL 확정 후:

1. Kakao Developers Web platform에 production origin 등록
2. NAVER 허용 도메인/서비스 설정 확인
3. Supabase Auth Site URL / Redirect URL 등록
4. CORS origin을 production frontend/public viewer origin으로 제한
5. localhost는 production 설정에서 불필요하면 제거

## 7. Spreadsheet parser release gate

보안 결정 기록:

- `docs/security-spreadsheet-parser.md`

현재 기준:

- `xlsx` locked version = `0.20.3`
- CVE-2023-30533 fixed-version floor = `0.19.3`
- CVE-2024-22363 fixed-version floor = `0.20.2`
- parser input size limit = 10 MiB
- XLSX/ZIP 및 XLS/OLE 실제 file signature 검증 후에만 parser 진입
- formula / HTML / VBA / dependency / embedded-file parsing 비활성화

release 직전 필수:

1. `package-lock.json`의 실제 locked version 확인
2. SheetJS/GitHub advisory source 재검토
3. `node scripts/validate-excel-security.mjs` PASS
4. 정상 `.xlsx`, legacy `.xls` import 확인
5. 비스프레드시트 파일을 `.xlsx`로 rename한 입력이 parser 전에 거부되는지 확인
6. `npm audit` zero만으로 SheetJS CDN dependency를 안전하다고 판정하지 않는다.

새 advisory가 현재 locked version에 영향을 주면 Production READY 판정을 중단하고 upgrade/replacement를 먼저 수행한다.

## 8. Production E2E gate

최종 배포 승인 전 실제 URL에서 아래를 모두 검증한다.

1. 로그인 → role/profile load
2. wrong bootstrap key 거부 → 최초 OWNER 1명 bootstrap → second bootstrap 거부 → bootstrap secret rotate/remove
3. OWNER 사용자 초대/role/status 관리
4. 마지막 active OWNER 강등/비활성화 차단
5. VIEWER read-only 차단
6. property CRUD 권한별 차단
7. Property/Data RLS 역할별 write/delete/verify/finalize 차단 검증
8. private Storage upload/read/delete 및 anon 직접 접근 차단
9. Blob/base64/data URL DB metadata 저장 거부 확인
10. Data Room upload/read/verification
11. local → remote → second-device persistence round trip
12. 1P/7P report render/print/PDF
13. signed Snapshot REMOTE/PUBLIC URL 생성
14. tampered Snapshot issuance 거부
15. 익명 recipient read-only resolve
16. expiry/revoke 후 접근 차단
17. review-note sync
18. remote share list에 raw token 비노출
19. NAVER geocode/static + Kakao POI/Roadview
20. backup/export 및 최소 1회 restore rehearsal
21. cross-device 동일 사용자 상태 확인
22. 브라우저 secret scan
23. Spreadsheet parser release gate PASS

## 9. 현재 상태

현재 repository 기준:

- LOCAL POLICY: READY
- REMOTE AUTH server code + migration: PREPARED / NOT DEPLOYED
- REMOTE AUTH backend connection: NOT CONFIGURED
- Property/Data schema + RLS: PREPARED / NOT APPLIED
- Property asset private Storage boundary: PREPARED / NOT APPLIED
- REMOTE DATA Gateway: PREPARED / NOT CONNECTED
- LOCAL / OFFLINE share: READY
- REMOTE / PUBLIC server code + migration: PREPARED / NOT DEPLOYED
- REMOTE / PUBLIC backend connection: NOT CONFIGURED
- production frontend host: MISSING EXTERNAL INFRA
- protected backend proxy: MISSING EXTERNAL INFRA
- production provider/domain allowlist: CHECK REQUIRED
- spreadsheet parser known-advisory baseline: PATCHED/PINNED
- spreadsheet parser release advisory review: REQUIRED

외부 인프라가 준비되기 전에는 위 상태를 임의로 READY로 바꾸지 않는다.
