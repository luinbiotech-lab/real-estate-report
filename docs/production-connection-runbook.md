# DA:ON Real Estate Platform — Production Connection Runbook

이 문서는 local-first 기준선을 실제 부동산 전용 운영환경으로 승격할 때의 연결 순서를 고정한다. 현재 repository의 LOCAL POLICY / LOCAL-OFFLINE 기능을 실제 Auth/RLS, REMOTE/PUBLIC 공유, production hosting으로 전환할 때만 사용한다.

## 0. 절대 금지

- 기존 GPS Tracker 또는 Sports AI Supabase 프로젝트를 재사용하지 않는다.
- `service_role` key, `sb_secret_` key, NAVER client secret, KAKAO REST key를 browser bundle에 넣지 않는다.
- legacy Supabase JWT의 `role=service_role` credential을 browser adapter에 사용하지 않는다.
- Auth backend가 없는데 로그인/RLS가 강제되는 것처럼 표시하지 않는다.
- REMOTE/PUBLIC backend가 없는데 public URL, remote revoke, server expiry가 가능한 것처럼 표시하지 않는다.
- raw external-share token을 DB에 저장하지 않는다. 서버에서 hash 후 `token_hash`만 저장한다.
- 실데이터를 사람 검증 없이 `verified`로 승격하지 않는다.

## 1. Dedicated backend provision

1. 부동산 전용 Supabase/backend 프로젝트를 새로 만든다.
2. project URL / browser-safe publishable 또는 legacy anon key / server-only service role credential을 분리한다.
3. service role 및 `sb_secret_` credential은 server/Edge Function 환경에만 저장한다.
4. production 도메인과 redirect URL을 Auth provider에 등록한다.
5. GPS/Sports 프로젝트와 project id, DB, storage, secret을 공유하지 않는다.

완료 조건: dedicated real-estate project 식별자가 별도로 존재하고, 다른 프로젝트의 credential을 사용하지 않는다.

## 2. Auth / profile / role bootstrap

준비된 코드:

- `supabase/migrations/20260916_auth_profiles_rls.sql`
- `supabase/functions/remote-auth-admin/index.ts`
- `supabase/functions/remote-auth-admin/README.md`
- `src/services/supabaseRemoteAuthGateway.ts`
- `src/services/supabaseBrowserCredential.ts`

현재 상태는 **SERVER DEPLOYED + BROWSER ADAPTER CONNECTED**이다. 실제 운영 OWNER 계정으로 로그인하기 전까지 QA OWNER와 실제 운영 사용자를 구분한다.

배포 순서:

1. Auth/profile migration을 부동산 전용 backend에만 적용한다.
2. `DAON_OWNER_BOOTSTRAP_KEY`를 32자 이상의 server-only secret으로 설정한다.
3. `AUTH_ADMIN_ALLOWED_ORIGINS`에 production frontend origin만 등록한다.
4. `supabase functions deploy remote-auth-admin`으로 배포한다. 이 함수에는 `--no-verify-jwt`를 사용하지 않는다.
5. frontend에는 Supabase project URL과 browser-safe publishable key 또는 legacy anon JWT만 주입한다.
6. `SupabaseRemoteAuthGateway`를 production provider로 연결한다. browser credential은 publishable key만 사용한다.
7. token store는 기본 memory-only를 사용한다. persistent session이 필요하면 별도 승인된 `RemoteAuthTokenStore`를 명시적으로 주입하고 token 저장정책을 별도 검토한다.
8. 첫 Auth 사용자를 생성하고 로그인한다.
9. 잘못된 bootstrap key가 거부되는지 확인한다.
10. 올바른 bootstrap key + authenticated session으로 최초 1명만 `owner`로 승격한다.
11. 두 번째 bootstrap 시도가 `bootstrap_already_completed`로 거부되는지 확인한다.
12. 최초 OWNER 생성 후 `DAON_OWNER_BOOTSTRAP_KEY`를 즉시 rotate/remove한다.
13. 신규 사용자가 기본 `viewer`로 생성되는지 확인한다.
14. anon 사용자가 `public.profiles`를 읽을 수 없는지 확인한다.

Browser credential 규칙:

- `sb_publishable_...` 계열은 browser-safe로 허용한다.
- legacy JWT는 payload의 `role=anon`일 때만 허용한다.
- `sb_secret_...`, legacy `role=service_role`, 문자열상 service-role credential은 browser adapter에서 즉시 거부한다.
- credential 값 자체는 오류 메시지/로그에 출력하지 않는다.

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
- browser bundle secret scan에서 `service_role`, `sb_secret_`, bootstrap secret 미검출

## 3. Property/Data persistence + RLS

준비된 코드:

- `supabase/migrations/20260916_property_data_rls.sql`
- `supabase/migrations/20260916_property_asset_storage.sql`
- `src/services/remoteDataGateway.ts`
- `src/services/supabaseRemoteDataGateway.ts`
- `src/services/supabaseBrowserCredential.ts`
- Remote Migration Readiness / dry-run manifest / handoff bundle

현재 상태는 **SCHEMA/RLS APPLIED + PRIVATE STORAGE APPLIED + SUPABASE REST/STORAGE ADAPTER CONNECTED**이다. 자동 migration은 금지하며 controlled migration만 수행한다.

적용 순서:

1. `20260916_auth_profiles_rls.sql`
2. `20260916_property_data_rls.sql`
3. `20260916_property_asset_storage.sql`
4. Auth adapter 로그인/profile/RLS 기본 동작을 먼저 검증한다.
5. Migration Readiness에서 dry-run manifest를 다시 생성하고 blocker = 0인지 확인한다.
6. `SupabaseRemoteDataGateway`와 `SupabaseRemoteAssetStorageGateway`를 authenticated user token/actor-id callback과 함께 명시적으로 연결한다.
7. 최소 1개 테스트 물건으로 controlled local → remote migration rehearsal을 수행한다.
8. remote record count / asset metadata / Storage object를 local manifest와 reconciliation한다.
9. second-device read/write 및 VIEWER/EDITOR/ADMIN/OWNER RLS positive/negative E2E 후에만 REMOTE DATA를 READY로 승격한다.

중요: migration/RLS 적용 전 또는 dry-run blocker가 남아 있는 상태에서는 remote adapter를 operational provider로 활성화하지 않는다.

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
- dry-run manifest와 remote row/object count reconciliation

## 4. REMOTE / PUBLIC external share

준비된 코드:

- `supabase/migrations/20260915_external_public_share.sql`
- `supabase/functions/remote-public-share/index.ts`
- `supabase/functions/remote-public-share/README.md`

현재 상태는 **DEPLOYED / PRODUCTION CONNECTED**이다. Edge Function 자체가 self-hosted read-only viewer를 제공하므로 별도 public viewer host는 선택사항이다.

배포 순서:

1. Auth/profile migration을 먼저 적용한다.
2. external-share migration을 적용한다.
3. 별도 viewer host를 쓰면 `PUBLIC_SHARE_BASE_URL`을 설정한다. 미설정 시 Edge Function 자체 URL을 사용한다. Cross-origin frontend는 `PUBLIC_SHARE_ALLOWED_ORIGINS` exact allowlist에 등록한다.
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
11. same-origin self-hosted viewer는 허용하고, cross-origin browser CORS는 `PUBLIC_SHARE_ALLOWED_ORIGINS` exact allowlist를 사용하며 wildcard origin을 사용하지 않는다.

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
- Supabase `sb_publishable_...` key 또는 legacy `role=anon` JWT
- Kakao JavaScript SDK key (도메인 제한 필수)

### Server-only

- `NAVER_MAP_CLIENT_ID`
- `NAVER_MAP_CLIENT_SECRET`
- `KAKAO_REST_API_KEY`
- Supabase `service_role` / `sb_secret_...`
- `DAON_OWNER_BOOTSTRAP_KEY`
- external-share token-management server secrets

proxy 승격 대상 route:

- `/api/maps/geocode`
- `/api/maps/static`
- `/api/poi/search`

proxy runtime 계약:

- `MAP_PROXY_HOST` / `MAP_PROXY_PORT`로 production bind를 외부 인프라에서 주입한다.
- `MAP_PROXY_ALLOWED_ORIGINS`는 쉼표 구분 exact origin만 허용하며 `*` wildcard를 금지한다.
- cross-origin 사용 시 OPTIONS preflight와 exact `Access-Control-Allow-Origin`을 사용한다.
- `/api/status`는 credential 값을 반환하지 않고 provider configured 여부와 allowlist 개수만 노출한다.
- 운영 배포에서 localhost를 사용할지, same-origin reverse proxy로 감출지는 host 구성에서 결정한다.

완료 조건: browser bundle/HTML/source map에서 server-only credential이 검출되지 않고, 허용되지 않은 Origin이 protected proxy에서 403으로 차단된다.

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

1. browser-safe Supabase key 유형 확인 → `sb_secret_` / service-role JWT 거부
2. 로그인 → role/profile load
3. wrong bootstrap key 거부 → 최초 OWNER 1명 bootstrap → second bootstrap 거부 → bootstrap secret rotate/remove
4. OWNER 사용자 초대/role/status 관리
5. 마지막 active OWNER 강등/비활성화 차단
6. VIEWER read-only 차단
7. property CRUD 권한별 차단
8. Property/Data RLS 역할별 write/delete/verify/finalize 차단 검증
9. private Storage upload/read/delete 및 anon 직접 접근 차단
10. Blob/base64/data URL DB metadata 저장 거부 확인
11. Migration Readiness dry-run blocker = 0 확인
12. Data Room upload/read/verification
13. local → remote → second-device persistence round trip
14. remote/local record count 및 asset metadata reconciliation
15. 1P/7P report render/print/PDF
16. signed Snapshot REMOTE/PUBLIC URL 생성
17. tampered Snapshot issuance 거부
18. 익명 recipient read-only resolve
19. expiry/revoke 후 접근 차단
20. review-note sync
21. remote share list에 raw token 비노출
22. NAVER geocode/static + Kakao POI/Roadview
23. backup/export 및 최소 1회 restore rehearsal
24. cross-device 동일 사용자 상태 확인
25. 브라우저 secret scan
26. Spreadsheet parser release gate PASS

## 9. 현재 상태

현재 repository / production Supabase 기준:

- LOCAL POLICY: READY
- REMOTE AUTH server code + migration: DEPLOYED
- Supabase browser Auth adapter: CONNECTED
- REMOTE AUTH backend connection: CONNECTED
- Property/Data schema + RLS: APPLIED
- Property asset private Storage boundary: APPLIED
- Remote Data Gateway: CONNECTED
- Supabase REST/Storage adapter: CONNECTED
- LOCAL / OFFLINE share: READY
- REMOTE / PUBLIC server code + migration: DEPLOYED
- REMOTE / PUBLIC backend: CONNECTED
- self-hosted public viewer: ACTIVE
- QA OWNER / EDITOR / VIEWER RLS E2E: PASS
- real operator OWNER Auth account: REQUIRED
- actual second-device browser E2E: REQUIRED
- production frontend host: MISSING EXTERNAL INFRA
- protected backend proxy: MISSING EXTERNAL INFRA
- production provider/domain allowlist: CHECK REQUIRED
- Supabase Auth leaked-password protection: MANUAL ENABLE REQUIRED
- spreadsheet parser known-advisory baseline: PATCHED/PINNED
- spreadsheet parser release advisory review: REQUIRED

서버가 연결되었다는 이유만으로 실사용 계정·도메인·second-device E2E까지 완료된 것으로 표시하지 않는다.
