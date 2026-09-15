# DA:ON Real Estate Platform — Implementation Status

Updated baseline: 2026-09-16
Verified baseline: `6d3087958c21d3779269461923db563b2de9d095` / GitHub Actions #688 PASS
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
- 최종 시각 디자인 선택은 사용자 지시에 따라 후속 단계로 보류

### Operations
- Portfolio Operations Hub
- Property Readiness Center
- Next Action Queue
- Readiness closed loop: OPENED → IMPROVED → COMPLETED
  - 수동 완료가 아니라 실제 readiness state 상승으로만 판정
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

### External share — local/offline
- standalone read-only HTML package
- Manifest / token / expiry / download policy
- ACTIVE / EXPIRED / REVOKED local audit
- external review notes
- External Share Center
- CSV / JSON audit export
- LOCAL / OFFLINE vs REMOTE / PUBLIC Provider boundary
- Remote gateway contract / secure migration draft

### Access — local policy + remote-ready boundary
- 사용자·권한 관리 UI
- local role policy matrix
- owner/admin/editor/viewer boundary
- LOCAL POLICY = READY
- REMOTE AUTH = NOT CONFIGURED
- Remote Auth gateway contract
- `profiles` / role / owner-only RLS migration draft
- 신규 remote 계정 기본 role = viewer
- anonymous profile access 금지 / service_role browser 노출 금지

### Production readiness automation
- CI `Validate production readiness boundary`
- CI `Validate production connection runbook`
- 운영 연결 문서 `docs/production-connection-runbook.md`
  - 부동산 전용 backend provision 순서
  - Auth/profile/최초 OWNER bootstrap
  - Property/Data RLS 확장 원칙
  - REMOTE/PUBLIC token hash·expiry·revoke 경계
  - frontend/protected proxy 배포 분리
  - provider/domain allowlist
  - production E2E gate
- 현재 상태를 다음과 같이 자동 판정
  - localDevelopment = READY
  - authBackend = NOT_CONFIGURED
  - remotePublicShare = NOT_CONFIGURED
  - productionFrontendHost = MISSING_EXTERNAL_INFRA
  - protectedBackendProxy = MISSING_EXTERNAL_INFRA
  - productionDomainAllowlist = CHECK_REQUIRED
- server-only NAVER/Kakao secret 경계 검증
- production proxy 승격 대상 API route 검증
- Excel import parser security boundary 검증 및 production dependency review gate

## 2. 부분 구축 — 외부 인프라가 있어야 완료되는 영역

### A. Remote / Public external share
코드 준비 완료:
- Local/Remote Provider boundary
- `RemoteExternalShareGateway` contract
- remote share migration draft
- raw token 비저장 / token hash 설계
- REMOTE / PUBLIC = NOT CONFIGURED 표시

실제 완료에 필요한 외부 조건:
- 부동산 전용 backend/Supabase 프로젝트
- public URL host
- server-side token validation
- real remote expiry / revoke
- remote review sync

주의: 현재 standalone HTML을 외부에 전달한 뒤에는 서버 권한으로 그 파일 자체를 원격 삭제할 수 없다.

### B. Real authentication / multi-user RLS
코드 준비 완료:
- local access policy와 화면
- Local/Remote Auth Provider boundary
- `RemoteAuthGateway` contract
- `profiles` / role / RLS migration draft
- owner-only administration 정책
- 신규 remote user viewer 기본값

실제 완료에 필요한 외부 조건:
- 부동산 전용 auth backend 프로젝트
- 실제 Auth user/session 연결
- migration 적용
- 최초 OWNER trusted bootstrap
- 실제 property/data table RLS 확장
- multi-device data persistence

### C. Production deployment
현재 준비 완료:
- front 5174 + local proxy 5175 개발 구조
- NAVER/Kakao REST secret은 proxy에 유지
- Production Readiness validator
- Production Connection Runbook + CI integrity validator
- 외부 인프라 미연결 상태 자동 판정

실제 완료에 필요한 외부 조건:
- production frontend host
- protected serverless/backend proxy
- production domain/provider allowlist
- secret/environment provisioning
- 실제 배포 URL 기준 E2E

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

1. local-first 내부 핵심 기능은 신규 화면을 반복 생성하지 않고 안정화/회귀검증 위주로 전환
2. 실제 데이터가 들어오면 Readiness Center의 Next Action Queue를 통해 보완
3. backend 계정을 별도로 준비하는 시점에 `docs/production-connection-runbook.md` 순서대로 Auth/RLS + Remote Public Share migration/gateway를 실제 provider에 연결
4. production host/backend가 정해지는 시점에 Production Readiness의 MISSING_EXTERNAL_INFRA 항목을 실제 연결로 전환
5. 사용자가 보고서 디자인을 선택하는 시점에 DAON_DETAIL_7P_MASTER 최종 form 확정
6. 마지막 단계에서 production deploy / cross-device sync / external delivery E2E 수행

## 6. 금지 원칙

- 기존 GPS/Sports Supabase 프로젝트를 부동산 프로젝트용으로 임의 재사용하지 않는다.
- backend가 없는데 public URL 또는 remote revoke가 가능한 것처럼 표시하지 않는다.
- Auth backend가 없는데 실제 로그인/RLS가 강제되는 것처럼 표시하지 않는다.
- service_role 또는 서버전용 지도 credential을 browser bundle에 넣지 않는다.
- 샘플/생성 이미지를 실제 현장사진 또는 verified data로 표시하지 않는다.
- imported 자료를 사람 검증 없이 verified로 승격하지 않는다.
- 방배동 815-11에 실내사진을 사용하지 않는다.
- 최종 MASTER 디자인은 사용자 확정 전 임의 변경하지 않는다.
