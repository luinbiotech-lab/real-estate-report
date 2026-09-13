# MASTER Code Lock 작업 기록

## 현재 판정

데이터/렌더러 분리 및 회귀 방지 기반은 구현했다. **Golden Reference와 시각적으로 동일하다는 최종 Code Lock 승인은 아직 보류**한다.
전체 페이지 이미지를 renderer로 사용하는 방식은 사용하지 않는다.
실제 외관·지도·로고 원본 연결, 원본 폰트/아이콘 및 모든 페이지의 인쇄 결과 대조가 남아 있다.

## 근본 원인과 수정

| 원인 | 수정 | 호환성 |
|---|---|---|
| MASTER 내부 방배동 문구·Property 직접 계산 | ReportDataBuilder → MasterPresentation / MasterTables → 순수 UI | 선택 Property 데이터만 사용 |
| 신규 보고서의 담당자·브랜드가 개별 Property에 종속 | Settings → BrandProfile → Snapshot에 캡처 | 기존 Property/Settings 자동 갱신 안 함 |
| templateId만 맞으면 미래 버전도 현재 renderer로 출력 | templateId/version 쌍으로 명시적 라우팅 | professional-v1 / daon-detail-7p-v1 별도 보존 |
| 내부사진 제한을 일부 슬롯에서만 검사 | 공통 정책, 전체 미디어 whitelist, 상충 분류 차단 | 기존 Snapshot은 변경하지 않고 위험한 출력만 차단 |
| 이미지 URL의 내용이 바뀌면 과거 출력도 변경 | 신규 Snapshot에 이미지 바이트 캡처 | 실패 URL은 데이터 미연결, 품질 집계도 갱신 |
| 시작할 때 샘플 생성·방배동 값 재작성 | 시작은 읽기만 수행 | 기존 사용자 저장값 삭제/덮어쓰기 없음 |
| 로컬 비보안 미리보기에서 crypto.randomUUID 미지원 | 암호학적 getRandomValues UUID v4 fallback | 기존 ID와 저장소 구조 유지 |
| 층별 현황·거래사례가 텍스트 placeholder | 출처를 보존하는 행 데이터 + 고정 표/막대 슬롯 | 기존 자유서술 거래사례 필드 보존 |

## 주요 변경 파일

- `src/domain/professionalReport/brandProfile.ts`, `mediaPolicy.ts`, `templateIds.ts`, `reportAccessPolicy.ts`, `valuePolicy.ts`
- `src/services/reportEngine/reportDataBuilder.ts`, `masterPresentation.ts`, `masterTables.ts`
- `src/components/professionalReport/DaonOnePageMaster.tsx`, `DaonDetail7PageMaster.tsx`, `LegacyDaonDetail7PageMaster.tsx`
- `src/pages/DocumentPreview.tsx`, `ProfessionalReportSnapshotPage.tsx`, `PropertyForm.tsx`, `SettingsPage.tsx`
- `src/components/MasterTableFields.tsx`, `src/daon-one-page-master.css`, `src/daon-detail-v2.css`
- `src/types.ts`, `src/domain/propertyDataRoom/types.ts`, `labels.ts`: optional 필드 및 provenance 유형만 추가
- `src/utils/createId.ts` 및 기존 UUID 호출부; `scripts/dev.mjs`, `vite.config.ts`: 미리보기 호환
- `tests/master.test.tsx`, `scripts/test-master.mjs`, `package.json`

## 재현 가능한 코드 검증

```sh
npm ci
npm run typecheck
npm run lint
npm run test:master
npm run build
git diff --check
```

2026-09-10 기준 타입검사·ESLint·회귀 12개·프로덕션 빌드 통과.
Vite 단일 JS 청크 약 1.14MB 경고는 남아 있으며, 실패로 숨기거나 경고 한도를 올리지 않았다.

회귀 테스트 범위:

- 물건별 문구 분리 및 신규 DA:ON 브랜드.
- 알려진/모르는/상충하는 templateId/version 라우팅.
- 방배동 제한, 유사 번지 제외, 타 물건 미디어 제외, 분류 충돌 양방향 차단.
- 공부상 주차 0, 현장 주차 0/2, 결측값, legacy 주차 비전용.
- 음수·0·NaN·Infinity·극단값 계산 차단.
- 층별/비교행 복사와 출처 보존, 표시 용량 초과 안내.
- 비보안 컨텍스트 UUID v4 fallback.
- 1P/7P React 출력 페이지 개수.
- fake IndexedDB 9개 store 보존, 동시 reportVersion 할당, snapshotData/브랜드 불변,
  상태 전환 후 불변, 중복 add 거부, ImportJob 일시정지/재개/재실행 중복 방지, 이미지 연결 실패 반영.

주의: fake IndexedDB 테스트는 사용자 Windows 브라우저의 실제 DB를 검증했다는 뜻이 아니다.
외부 NAVER/Kakao API는 키 미설정 상태로, 실연결 회귀는 미검증이다.

## 브라우저 검증과 한계

- 별도 미리보기의 QA 샘플을 사용한다. 사용자 실제 Property/IndexedDB에는 접근하거나 변경하지 않았다.
- 성수동 샘플 저장 → 1P 생성 → 7P Snapshot 생성 성공.
- 성수동 출력에서 방배동/BANGBAE/래미안/서래마을 0건.
- v3 신규 출력에서 사무실 주소는 제거했다. 과거 v2 Snapshot 출력은 당시 연락처를 유지한다.
- A4 DOM 크기 약 793.69×1122.52 CSS px. 7P 일곱 페이지 확인.
- 샘플 7P 전체 DOM 박스 넘침 0건. 1P 도로 도식의 회전 장식은 의도적으로 clip하며 텍스트 넘침과 구분한다.
- 방배동 식별 후 내부사진 허용 체크박스 비활성화 확인.
- 방배동 1P/7P 생성 성공. 현장 2대/현장 이용 기준과 공부상 확인 필요 분리 확인.
- 방배동 7P 일곱 페이지, 샘플 전체 DOM 박스 넘침 0건. 사진 0장이므로 실제 사진 crop 검증을 대신하지 않는다.
- 실제 사진 crop·인쇄 PDF 최종 페이지·모바일 가독성·원본과 픽셀 수준 일치는 별도 최종 검수가 필요하다.

## 고정/운영 규칙

- 새 1P: DAON_1P_MASTER / daon-1p-v3.
- 새 7P: DAON_DETAIL_7P_MASTER / daon-detail-7p-v3 / report-engine-2.
- v1 CSS와 v1 renderer를 재작성하지 않는다. 신규 변경은 버전 범위 안에서 관리한다.
- 보고서 생성/설정 변경은 Property를 수정하지 않는다. 문구·층별·비교자료는 물건 편집 후 명시적 저장으로만 반영한다.
- 층별 4행, 비교 5사례+본건으로 MASTER 공간을 유지하며 초과 자료는 Snapshot 원본에 보존한다.
- 사진 자료는 현재 저작권/공유 허용 범위와 분류를 확인한다. 내부 제한이면 미분류도 출력하지 않는다.
- 출처 수집과 검증 UI의 후속 연결 시에도 자동 추출값은 기존 확정값을 자동 덮어쓰지 않는다.

## 다음 단계

`bangbae-master-mapping.md`에 후보값과 필요한 원본을 정리했다.
개별 외관/지도·공적자료를 Data Room에 연결하고 불일치를 확인한 다음,
실제 방배동 1P/7P를 원본과 대조하여 최종 시각 잠금 여부를 판정한다.
본 브랜치를 master에 병합하거나 운영 배포하지 않았다.

코드 체크포인트: `e504886` (fix: isolate DAON master data and preserve legacy snapshots).
독립 코드 검토에서 찾은 7P 주차 누락과 명시적 내부사진 분류의 URL 중복 우회를 수정하고 회귀 테스트에 반영했다.

## 2026-09-10 연락처 및 외관 보정 체크포인트

- 신규 1P 푸터는 M / E 두 줄만 출력한다. 로고·우측 브랜드 영역과 CSS 배치는 유지한다.
- 신규 7P는 마지막 문의 영역에 M / E를 한 번씩 출력하며, 각 페이지 푸터는 브랜드 문의 문구를 유지한다.
- 이전 v2 renderer는 `LegacyDaonDetail7PageMasterV2.tsx`에 보존했다. 기존 Snapshot 데이터나 버전을 다시 쓰지 않는다.
- 실제 본건 외관 원본을 확인하고 상호·전화번호·전깃줄을 보정한 별도 자산을 추가했다. 원본은 변경하지 않았다.
- 사진 파일과 SHA-256, 분류, 보정 이력, 짧은 Hero 문구, 현장 주차/면적 매핑은 `bangbae-media-mapping.json`에 기록했다. 앱 시작 시 자동 연결하거나 Property를 덮어쓰지 않는다.
- 이번 체크포인트에서는 PDF 생성 및 페이지별 PNG 최종검수를 완료하지 않았다. 최종 시각 Code Lock 및 실제 데이터 완전 매핑은 아직 보류다.
