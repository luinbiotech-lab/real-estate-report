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

적용 migration:

- `supabase/migrations/20260916_auth_profiles_rls.sql`

순서:

1. migration을 부동산 전용 backend에만 적용한다.
2. 첫 사용자를 Auth에서 생성한다.
3. trusted admin/server 경로로 최초 1명만 `owner`로 승격한다.
4. browser에서 자기 role을 임의 변경할 수 없는지 확인한다.
5. 신규 사용자가 기본 `viewer`로 생성되는지 확인한다.
6. anon 사용자가 `public.profiles`를 읽을 수 없는지 확인한다.

완료 조건:

- authenticated session 동작
- profile persistence 동작
- owner-only user administration 동작
- inactive profile 차단 정책 확인
- multi-device에서 동일 profile/role 확인

## 3. Property/Data RLS expansion

현재 Auth migration은 `profiles` 경계까지만 준비되어 있다. 실제 운영 전에는 property/data 관련 운영 테이블에 RLS를 확장해야 한다.

최소 정책:

- OWNER: 전체 관리
- ADMIN: 운영 데이터 관리, 사용자/회사 소유권 변경 제외
- EDITOR: 허용된 물건 수정·업로드·분석·draft
- VIEWER: 허용된 데이터 read-only

완료 조건: role matrix의 server-side enforcement가 `accessControlService.ts`의 capability 정책과 모순되지 않는다.

## 4. REMOTE / PUBLIC external share

적용 migration:

- `supabase/migrations/20260915_external_public_share.sql`

서버/Edge Function에서 반드시 수행:

1. 충분한 entropy의 raw token을 issuance 시점에만 생성한다.
2. raw token을 SHA-256 이상으로 hash하여 `token_hash`만 DB에 저장한다.
3. 조회 시 presented token을 서버에서 hash하여 session을 resolve한다.
4. `revoked_at`, `expires_at`, `read_only`, `allow_download`를 서버에서 검사한다.
5. public client가 `external_share_sessions` 테이블을 직접 조회하지 못하게 유지한다.
6. review-note write도 동일 token validation을 통과한 경우에만 허용한다.

완료 조건:

- public URL 발급
- 만료 후 접근 차단
- revoke 후 즉시 접근 차단
- download policy 강제
- remote review sync
- raw token DB 비저장 확인

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
- external-share signing/token-management server secrets

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
4. CORS origin을 production frontend로 제한
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
2. OWNER 사용자 관리
3. VIEWER read-only 차단
4. property CRUD 권한별 차단
5. Data Room upload/read/verification
6. 1P/7P report render/print/PDF
7. REMOTE/PUBLIC URL 생성
8. 익명 recipient read-only view
9. expiry/revoke
10. review-note sync
11. NAVER geocode/static + Kakao POI/Roadview
12. backup/export 및 최소 1회 restore rehearsal
13. cross-device 동일 사용자 상태 확인
14. 브라우저 secret scan
15. Spreadsheet parser release gate PASS

## 9. 현재 상태

현재 repository 기준:

- LOCAL POLICY: READY
- REMOTE AUTH: NOT CONFIGURED
- LOCAL / OFFLINE share: READY
- REMOTE / PUBLIC share: NOT CONFIGURED
- production frontend host: MISSING EXTERNAL INFRA
- protected backend proxy: MISSING EXTERNAL INFRA
- production provider/domain allowlist: CHECK REQUIRED
- spreadsheet parser known-advisory baseline: PATCHED/PINNED
- spreadsheet parser release advisory review: REQUIRED

외부 인프라가 준비되기 전에는 위 상태를 임의로 READY로 바꾸지 않는다.
