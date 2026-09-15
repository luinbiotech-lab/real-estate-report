# DA:ON Real Estate Platform

DA:ON ASSET의 부동산 물건관리, Property Data Room, 검증, 비교거래, 임대·수익 분석, Agent, Digital Twin, Risk, 보고서 Snapshot, 외부검토를 하나의 local-first 운영 흐름으로 연결하는 플랫폼입니다.

현재 구현상태와 남은 외부 의존성은 [`docs/implementation-status.md`](docs/implementation-status.md)를 기준으로 관리합니다. 완료 기능을 반복 개발하지 않고, `완료 / 외부 인프라 의존 / 실데이터 의존 / 사용자 보류`를 분리합니다.

## 핵심 운영 흐름

```text
물건 목록
  ↓
물건 상세 메인 허브
  ├─ 사진 · 미디어
  ├─ 문서 · 공적자료
  ├─ 비교거래
  ├─ 임대 · 수익 분석
  ├─ 검토 이력
  ├─ 보고서 Snapshot
  ├─ 3D · Digital Twin
  └─ 입지 브리핑

Portfolio Operations
  ├─ Property Readiness Center
  ├─ Next Action Queue
  ├─ OPENED → IMPROVED → COMPLETED 폐루프
  ├─ 사용자 · 권한 정책
  ├─ 외부 공유 감사
  └─ Data Backup / Restore
```

Readiness의 `COMPLETED`는 사용자가 임의 체크하는 값이 아닙니다. 실제 저장 데이터에서 해당 stage가 `READY`로 상승한 경우에만 자동 판정됩니다. `imported` 자료는 별도 Verification 없이 `verified` 또는 READY로 승격하지 않습니다.

## 현재 주요 기능

- Property CRUD / Excel 대량등록
- Property Detail Hub / Data Room 딥링크
- Data Room: 개요, 사진, 문서, 공적자료, 비교거래, 검증, 보고서, 3D
- 건축물대장 등 구조화 데이터와 provenance 관리
- 비교거래 구조화 / 시장 요약
- 임대·수익 시나리오: EGI, NOI, Cap Rate, Cash-on-Cash
- 통합 검토 이력
- A0–A10 modular Agent architecture
- Interior / Spatial / Room Operations
- 3D·도면 Intake / Digital Twin Workspace
- Risk / Compliance
- Report Snapshot / 버전 이력
- External Share Center / standalone read-only HTML / 감사 CSV·JSON
- Property Readiness / Next Action Queue / progress closed loop
- 회사·브랜드 기본설정
- 전체 local data backup / MERGE·REPLACE restore
- Local/Remote Auth Provider boundary 및 Auth/RLS migration draft
- Local/Remote External Share Provider boundary 및 remote gateway contract
- Production Readiness CI preflight

보고서 구조는 `DAON_1P_MASTER`, `DAON_DETAIL_7P_MASTER`를 유지합니다. 최종 시각 디자인은 사용자 확정 전 임의 변경하지 않습니다.

## 개발 실행

```bash
npm install
npm run dev
```

기본 포트:

- Frontend: `http://localhost:5174`
- Local map/API proxy: `http://localhost:5175`
- GPS Tracker의 5173 포트와 분리

필요 시 별도 실행:

```bash
npm run dev:proxy
npm run dev:frontend
```

## 지도 / Roadview Provider

프로젝트 루트 `.env`에 서버 전용 키를 설정합니다.

```env
NAVER_MAP_CLIENT_ID=
NAVER_MAP_CLIENT_SECRET=
KAKAO_REST_API_KEY=
VITE_KAKAO_JAVASCRIPT_KEY=
```

- NAVER: geocoding / static map 우선 Provider
- Kakao: POI / Roadview 및 fallback
- NAVER Client Secret과 Kakao REST key는 브라우저에 노출하지 않고 5175 proxy에서 사용
- Kakao JavaScript key는 Roadview SDK용

기존 `VITE_` REST credential이 있다면:

```bash
npm run migrate:env
```

`.env`는 Git 추적 대상이 아닙니다.

### Roadview 안전 원칙

Roadview는 외관 확인용 DOM viewer입니다. 앱은 Roadview 이미지를 자동 다운로드·스크린샷·대표사진으로 복사하지 않습니다. 사용자가 확인을 기록하면 Provider / panoId / 촬영일(제공 시) / 확인시각 메타데이터만 저장합니다.

## 데이터 저장 / 백업

현재 운영 데이터는 브라우저 IndexedDB `real-estate-report`에 저장됩니다. 문서·미디어·3D 원본 Blob과 Agent/검증/Report/공유 이력도 local-first 구조입니다.

`데이터 백업 · 복원` 화면은:

- 모든 IndexedDB object store
- key + value
- Blob / ArrayBuffer
- `daon:` localStorage 운영 상태

를 하나의 버전된 JSON 백업으로 내보냅니다.

복원 모드:

- `MERGE`: 현재 데이터 유지 + 백업 데이터 추가/갱신
- `REPLACE`: 현재 로컬 store를 비운 뒤 백업 기준 교체

CI에서는 실제 Blob을 저장한 뒤 `백업 다운로드 → 파일 Preview → MERGE restore → Blob 내용 일치` round-trip까지 검증합니다.

## 외부 공유 경계

### LOCAL / OFFLINE — 현재 사용 가능

- standalone read-only HTML
- Manifest
- token / expiry / download policy
- ACTIVE / EXPIRED / REVOKED 로컬 감사상태
- 외부 검토 코멘트 기록

### REMOTE / PUBLIC — 아직 미연결

코드에는 Provider boundary, gateway contract, migration draft가 준비돼 있지만 실제 public URL / 서버 만료 / remote revoke / 인증 접근은 부동산 전용 backend가 연결돼야 동작합니다.

**현재 standalone HTML을 상대에게 전달한 뒤 그 복사본 자체를 원격 삭제하거나 차단할 수 있다고 표시하지 않습니다.**

기존 GPS Tracker 또는 Sports-AI Supabase 프로젝트를 이 부동산 플랫폼에 임의 재사용하지 않습니다.

## 사용자 · 권한

- `LOCAL POLICY = READY`
- `REMOTE AUTH = NOT CONFIGURED`
- owner / admin / editor / viewer 역할표 유지
- Remote Auth gateway contract 준비
- `profiles` / role / owner-only RLS migration draft 준비

실제 다중 사용자 로그인, 세션, RLS, owner-only administration은 부동산 전용 Auth backend가 연결될 때 활성화합니다.

## 방배동 815-11 정책

- 실내사진 사용 금지
- 외관, 도로, 주변환경, 출입구, facade, 항공/주차 외부맥락만 허용
- generated/sample image는 실제 현장사진으로 표기하지 않음
- imported public record/comparable data는 별도 사람 검증 전 verified로 승격하지 않음

## 검증

GitHub Actions `Validate` workflow에서 다음을 지속 검증합니다.

- DAON report master integrity
- Report pipeline
- Agent foundation / modularity
- Digital Twin building flow / geometry mutation
- Platform workflow
- Access policy + Auth Provider/RLS boundary
- Portfolio hub
- Property readiness + closed-loop worklog
- Company settings / report contact policy
- Local backup / restore
- Production readiness boundary
- Typecheck / Lint / Build
- Playwright rendered QA
- 기존 report render regression

대표 로컬 검증 명령:

```bash
npm run typecheck
npm run lint
npm run build
npm run validate:masters
npm run validate:pipeline
npm run validate:agents
npm run validate:twin-building
npm run validate:platform
npm run readiness:prod
```

## 운영 배포 전 남은 외부 조건

현재 준비상태는 다음 명령으로 확인합니다.

```bash
npm run readiness:prod
```

현재 외부 인프라가 없으므로 `NOT_CONFIGURED`, `MISSING_EXTERNAL_INFRA`, `CHECK_REQUIRED`가 표시되는 것이 정상입니다.

실제 연결 순서는 [`docs/production-connection-checklist.md`](docs/production-connection-checklist.md)를 따릅니다.

남은 외부 조건:

- 부동산 전용 backend/Auth 프로젝트
- authenticated session / RLS
- production map proxy / secret provisioning
- public share URL host
- server-side expiry/revoke/review sync
- production frontend domain 및 Provider allowlist
- 실제 현장 미디어와 사람 Verification

구체적인 기준선은 [`docs/implementation-status.md`](docs/implementation-status.md)를 참조합니다.
