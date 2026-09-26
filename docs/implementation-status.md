# DA:ON Real Estate Platform — Implementation Status

Updated baseline: 2026-09-18
Verified baseline: `da7aa931e4eedde9669a11a39942fbca7fb9980f` / GitHub Actions #775 PASS
Branch: `feat/daon-master-code-lock`

이 문서는 완료 기능을 반복 개발하지 않고, 실제 미구축 영역과 외부 의존성을 분리하기 위한 현재 기준선이다.

## 1. 구축 완료 — local-first 운영 범위

### Property / Data Room
- 물건 CRUD, 검색, Excel 대량등록
- 물건 상세 메인 허브 → 세부 Workspace 딥링크
- Data Room: 개요, 사진, 문서, 공적자료, 비교거래, 검증, 보고서, 3D
- 공적자료 기반 층별 구조화 / provenance 표시
- 비교거래 구조화 및 개요 요약
- 방배동 815-11 내부사진 금지 중앙 media policy
- Kakao Roadview 확인기록 / NAVER geocode-static + Kakao fallback 체계

### Analysis / Review
- 임대·수익 시나리오: EGI, NOI, Cap Rate, Cash-on-Cash
- 통합 검토 이력: verification / agent review / report snapshot / external review
- Risk / Compliance Workspace
- 입지 브리핑 / BrandMap

### Agent / Spatial / Digital Twin
- A0 Control Center
- A1–A10 modular Agent architecture
- Bulk Intake / Verification
- Interior / Spatial / Room Ops
- 3D·도면 Intake
- Digital Twin Workspace
- 원격검토 handoff / standalone viewer

### Report foundation
- DAON_1P_MASTER / DAON_DETAIL_7P_MASTER 코드 잠금
- Report Snapshot / 버전 이력
- Report Pipeline / renderer QA
- 보고서 렌더 QA 이미지 로딩·레이아웃 안정화
- 최종 시각 디자인 선택은 사용자 지시에 따라 후속 단계로 보류

### Operations
- Portfolio Operations Hub
- Property Readiness Center
- Next Action Queue
- Readiness closed loop: OPENED → IMPROVED → COMPLETED
- 회사·브랜드 기본설정
  - 보고서 연락처 정책: 휴대폰 + 이메일만
  - 기존 물건 담당자 자동 덮어쓰기 금지
- 전체 Local Data Backup / Restore
  - IndexedDB 모든 store
  - out-of-line key 보존
  - Blob / ArrayBuffer Base64 직렬화
  - `daon:` localStorage 운영상태
  - MERGE / REPLACE
  - 다운로드 → Preview → MERGE → Blob round-trip E2E

### Remote migration rehearsal — dry-run only
- 현재 IndexedDB → remote schema 변환계획 생성
- 실제 network write = 0 고정
- Property / modular objects / verification / report snapshot mapping
- document/media/Digital Twin binary는 private Storage upload plan으로 분리
- orphan property reference 탐지
- inline data URL / structured binary / binary 누락 / 50MiB 초과 / unsupported store blocker 탐지
- Migration Readiness Review 화면
- Manifest JSON 다운로드
- Handoff Bundle 다운로드
- Handoff Bundle은 secrets / raw binary / remote execution을 포함하지 않음
- productionReady는 외부 E2E 전 항상 false
- rendered migration QA로 payload blocker / manifest / handoff 계약 검증

### External share — local/offline
- standalone read-only HTML package
- Manifest / token / expiry / download policy
- ACTIVE / EXPIRED / REVOKED local audit
- external review notes
- External Share Center
- CSV / JSON audit export
- LOCAL / OFFLINE vs REMOTE / PUBLIC Provider boundary

### Access — local policy
- 사용자·권한 관리 UI
- local role policy matrix
- owner/admin/editor/viewer boundary
- LOCAL POLICY = READY

### Production/security automation
- Excel XLS/XLSX 실제 file signature 사전검증
- 10 MiB import limit / formula·HTML·VBA·embedded parsing hardening
- SheetJS `0.20.3` pinned + known-advisory floor `>=0.20.2`
- release 시 vendor/GitHub advisory 재검토 gate
- Production readiness / runbook / remote share / remote auth / property data RLS / migration rehearsal CI validators
- Supabase browser credential validator
  - publishable / legacy anon key만 허용
  - `sb_secret_` key 차단
  - legacy JWT payload의 `role=service_role` 차단
  - malformed JWT 차단
- Typecheck / Lint / Build / rendered smoke QA 전체 PASS 기준 유지

## 2. 서버 연결 준비 완료 — 실제 배포/연결은 아직 하지 않음

### A. REMOTE AUTH
상태:
- server code + migration = DEPLOYED
- Supabase browser Auth adapter = PREPARED / NOT CONNECTED
- backend server connection = CONNECTED
- production OWNER bootstrap = QA OWNER E2E COMPLETE / real operator account pending

준비된 항목:
- `profiles` / role / owner-only RLS migration
- 신규 remote user 기본 role = viewer
- anonymous profile access 금지
- `remote-auth-admin` Edge Function
- 최초 OWNER: authenticated user + 별도 server-only bootstrap key 동시 요구
- 첫 active OWNER 생성 후 bootstrap endpoint 재사용 차단
- bootstrap key 최소 32자 / 비교 early-exit 방지
- active OWNER만 invite / role / status / profile-list 관리
- 마지막 active OWNER 강등·비활성화 차단
- exact-origin CORS / service_role browser 노출 금지
- Supabase Auth REST browser adapter
  - password sign-in
  - refresh token
  - authenticated user 확인
  - profile role/is_active 조회
  - owner admin action은 `remote-auth-admin`만 호출
  - 기본 token store는 memory-only
  - token persistence는 실제 운영 시 별도 승인된 store를 명시 주입

실제 완료 조건:
- 부동산 전용 Supabase/Auth 프로젝트
- migration 실제 적용
- adapter에 실제 project URL/public anon key/session store 주입
- 첫 OWNER bootstrap E2E
- bootstrap secret rotate/remove
- multi-device session/profile 검증

### B. Property/Data persistence + RLS
상태:
- schema + RLS = APPLIED
- private asset Storage boundary = APPLIED
- Remote Data Gateway contract = PREPARED
- Supabase REST/Storage adapter = PREPARED / NOT CONNECTED
- server persistence boundary = CONNECTED
- frontend remote provider binding = NOT CONNECTED

준비된 항목:
- `properties`: active read, OWNER/ADMIN/EDITOR create/update, OWNER delete
- `property_objects`: non-binary modular Data Room/Agent/Spatial/Risk data
- `property_verification_candidates`: EDITOR+ pending 후보 제출, OWNER/ADMIN 결정
- `property_verifications`: OWNER/ADMIN append
- `report_snapshots`: EDITOR draft only, OWNER/ADMIN draft/final, immutable
- `company_settings`: OWNER write
- 모든 operational table RLS enable / anon revoke
- private `daon-property-assets` Storage bucket
- document/media/Digital Twin binary는 Storage에 저장하고 DB에는 metadata/path만 저장
- Blob/base64/data URL을 DB metadata에 직접 넣지 못하도록 경계 설정
- `RemoteDataGateway` contract
- Supabase REST adapter
  - authenticated bearer token + public anon/publishable key 사용
  - actor id를 `created_by` / `updated_by`와 RLS에 맞춰 전달
  - browser `sb_secret_` / legacy `service_role` 금지
  - cache `no-store`
- Supabase private Storage adapter
  - private bucket upload/download/remove contract
  - 50 MiB hard cap
  - path traversal 차단

실제 완료 조건:
- migrations 실제 적용
- Auth adapter와 Data/Storage adapter 실제 연결
- local → remote controlled migration execution
- second-device persistence E2E
- 역할별 RLS negative/positive test
- local/remote record count reconciliation

### C. REMOTE / PUBLIC external share
상태:
- server code + migration = DEPLOYED
- Edge Function = ACTIVE
- anonymous invalid-token resolve E2E = PASS
- authenticated issue/revoke/list E2E = PENDING real Auth session + public viewer host

준비된 항목:
- `remote-public-share` Edge Function
- raw token은 발급 시 1회만 반환
- DB에는 SHA-256 `token_hash`만 저장
- audit/list 응답 raw token/public URL 비노출
- revoke / expiry / allow_download 검사
- anonymous resolve/review와 authenticated management 분리
- exact-origin CORS / `Cache-Control: no-store`
- Release Snapshot 발급 전 canonical package + SHA-256 checksum + ECDSA P-256 signature 서버 검증
- tampered snapshot 발급 차단

실제 완료 조건:
- public viewer host
- Edge Function 실제 배포
- issue → resolve → review → revoke → blocked resolve E2E

### D. Production deployment
상태:
- production frontend host = MISSING EXTERNAL INFRA
- protected backend proxy = MISSING EXTERNAL INFRA
- provider/domain allowlist = CHECK REQUIRED

준비된 항목:
- front 5174 + local proxy 5175 개발 구조
- NAVER/Kakao REST secret server-only 경계
- `/api/maps/geocode`, `/api/maps/static`, `/api/poi/search` production 승격 대상 고정
- `docs/production-connection-runbook.md`
- `docs/production-connection-checklist.md`

### E. 실제 production 연결 검증 완료 항목
- production project: `real-estate-report-production` / Seoul region / ACTIVE_HEALTHY
- Auth/Profile migration 적용
- Property/Data RLS 적용
- private `daon-property-assets` Storage 적용
- REMOTE/PUBLIC share schema 적용
- `remote-auth-admin` Edge Function ACTIVE / JWT verification ON
- `remote-public-share` Edge Function ACTIVE / custom token validation / JWT verification OFF
- QA roles: OWNER / EDITOR / VIEWER
- RLS E2E PASS: VIEWER read / VIEWER write deny / EDITOR create / EDITOR property delete deny / EDITOR final report deny / OWNER delete
- controlled migration QA records 유지 및 provenance `imported` 보존
- production QA controlled migration 재검증 PASS: Property 1 + modular object 1 write/read-back/reconciliation, 검증 후 QA 데이터 삭제
- independent authenticated DB-session round trip PASS: session A write → session B read/update → session A read-back
- `production_rls_and_share_hardening` migration 적용
- RLS auth init-plan 성능 경고 13건 해소
- FK covering index 14건 보완
- external-share direct anon/authenticated access restrictive deny 정책 추가
- remote-public-share invalid-token resolve HTTP = 404 `not_found`
- remote-public-share public-path production HTTP E2E PASS: active resolve 200 / review 201 / unauthenticated revoke 401 / revoked resolve+review 410 / expired resolve 410
- self-hosted public viewer HTTP 200 + READ-ONLY marker + noindex/nofollow/noarchive 확인
- remote share raw token DB 미저장 확인: raw token match 0 / SHA-256 token_hash match 1 / anon direct grant 0
- private RLS helper hardening 복구
- anon direct table/function privilege 제거
- private Storage `public=false` + object policy 4개 재검증 PASS
- OWNER / EDITOR / VIEWER DB role matrix 재검증 PASS
- temporary `pg_net` E2E extension 제거

### F. 외부 설정/실사용 계정이 있어야 마감되는 항목
- 실제 운영 OWNER Auth 계정 생성/로그인
- Local Backup / Migration Manifest / Handoff Bundle 확보 후 실데이터 controlled migration
- frontend Auth/Data provider 실제 주입
- production frontend/public viewer host
- `AUTH_ADMIN_ALLOWED_ORIGINS`, `PUBLIC_SHARE_ALLOWED_ORIGINS`, `PUBLIC_SHARE_BASE_URL` 실제 운영값
- real OWNER JWT 기반 authenticated issue/list/revoke acceptance E2E
- signed Snapshot issue/tamper rejection의 real OWNER JWT 네트워크 acceptance
- second-device 실제 browser session E2E (server-side independent-session round trip은 PASS)
- Supabase Auth Leaked Password Protection 활성화(대시보드 설정)

## 3. 실데이터가 있어야 완료할 수 있는 항목

코드로 임의 READY 처리하지 않는다.

- 현장 외관/도로/주변/출입구 등 실제 미디어
- 최신 공적자료의 사람 검토/Verification
- 임대조건 등 실제 소유자/중개 입력값
- 3D/도면 실제 원본
- 현장 확인이 필요한 주차/사용현황

특히 `imported`는 `verified`와 다르며, Verification 기록이 없으면 READY로 승격하지 않는다.

## 4. 사용자 지시로 보류 중

- 최종 1P/7P 보고서 시각 디자인 확정
- 선택 디자인을 실제 MASTER form으로 최종 고정
- 숏영상 재활용/영상 제작

현재 보고서 MASTER 구조를 임의로 재디자인하지 않는다.

## 5. 다음 우선순위 원칙

1. 외부 backend가 없는 동안에는 실제 remote write를 만들지 않고 adapter / dry-run / handoff / validator만 준비한다.
2. 부동산 전용 backend가 준비되면 `docs/production-connection-runbook.md` 순서대로 Auth → Property/Data RLS → Storage → Remote Data → Remote Public Share를 연결한다.
3. 연결 직전 dry-run Manifest/Handoff를 다시 생성하고 blocker 0을 확인한다.
4. 실제 데이터가 들어오면 Readiness Center의 Next Action Queue를 통해 보완한다.
5. production host/backend가 정해지는 시점에 MISSING_EXTERNAL_INFRA 항목을 실제 연결로 전환한다.
6. 사용자가 보고서 디자인을 선택하는 시점에 DAON_DETAIL_7P_MASTER 최종 form을 확정한다.
7. 마지막 단계에서 production deploy / cross-device sync / external delivery E2E를 수행한다.

## 6. 금지 원칙

- 기존 GPS/Sports Supabase 프로젝트를 부동산 프로젝트용으로 임의 재사용하지 않는다.
- backend가 없는데 public URL 또는 remote revoke가 가능한 것처럼 표시하지 않는다.
- Auth backend가 없는데 실제 로그인/RLS가 강제되는 것처럼 표시하지 않는다.
- server code/migration/adapter가 준비됐다는 이유만으로 REMOTE 기능을 READY로 표시하지 않는다.
- service_role, `sb_secret_`, OWNER bootstrap secret 또는 서버전용 지도 credential을 browser bundle에 넣지 않는다.
- binary Blob/base64/data URL을 production DB JSONB에 직접 저장하지 않는다.
- remote migration rehearsal 화면에서 실제 network write를 수행하지 않는다.
- 샘플/생성 이미지를 실제 현장사진 또는 verified data로 표시하지 않는다.
- imported 자료를 사람 검증 없이 verified로 승격하지 않는다.
- 방배동 815-11에 실내사진을 사용하지 않는다.
- 최종 MASTER 디자인은 사용자 확정 전 임의 변경하지 않는다.