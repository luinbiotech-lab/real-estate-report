# 방배동 815-11 MASTER 데이터 매핑 준비

## 상태와 적용 경계

아래는 사용자가 제공한 요약보고서(3).png에서 읽은 **자료 대조용 후보값**이다.
공적자료 검증 완료값이 아니며 Property에 자동 저장하거나 기존 값을 덮어쓰지 않는다.
`source=uploaded_document`, `verificationStatus=unverified`, `checkedAt`은 실제 대조 시점에만 입력한다.
현장·권리·거래 자료 검증 없이 신규 매각 보고서의 확정 사실로 사용하지 않는다.

| MASTER 슬롯 | 코드 필드 | 참고자료 후보값 / 처리 |
|---|---|---|
| 물건명 | name | 방배동 815-11 코너빌딩 |
| 주소 | address | 서울 서초구 동광로18길 7 |
| 희망매매가 | salePrice | 4,150,000,000원, 현재 매도 희망가 재확인 |
| 토지 | landAreaSqm / landAreaPyeong | 168.1㎡ / 50.85평 |
| 연면적 | totalFloorAreaSqm / totalFloorAreaPyeong | 349.08㎡ / 105.60평 |
| 건축면적 | buildingAreaPyeong | 24.80평; 원본에는 81.98㎡ 병기. ㎡ 독립 저장 필드 연결은 후속 과제 |
| 용적률 산정면적 | floorAreaForRatioSqm | 245.94㎡ |
| 지목 | landCategory | 대 |
| 용도지역 | zoning | 제2종일반주거지역 (7층 이하), 최신 토지이용계획 대조 |
| 주용도 | mainUse | 주택 및 근린생활시설 |
| 사용승인 | completionDate | 1978-07-31, 건축물대장 대조 |
| 층수 | basementFloors / groundFloors | 지하 1층 / 지상 3층 |
| 현재 이용 | currentUse | 소유자 직접 사용 (사옥·주택), 현장 확인 |
| 명도 | vacancyCondition | 잔금일 기준 전체 명도 가능, 매도인 재확인 |
| 지하 특화 | basementUse | 방음시설 설치, 설명만 가능, 내부사진 금지 |
| 공부상 주차 | parkingOfficial | **미확인 → undefined. 0으로 추정 금지** |
| 현장 이용 주차 | parkingField / parkingFieldNote | 2 / 현장 이용 기준, 현장 재확인 |
| 내부사진 정책 | internalPhotoAllowed | false; 기존 true가 있어도 방배동 식별 시 제한 |
| Hero 문구 | reportContent.heroHeadline | 서초의 가치,\n특별한 코너.\n더 큰 가능성. |
| Hero 보조 | reportContent.heroSubline | BANGBAE-DONG\nPREMIUM ASSET |
| 위치 설명 | reportContent.locationHeadline | 프리미엄이 모이는 서초의 중심, 방배동 |
| 투자 포인트 | reportContent.keyHighlights | 원본의 7개 항목을 물건 데이터로 입력, 사실/의견 구분 |
| 층별 표 | floorUsageRows | 건축물대장·임대/이용 현황 대조 후 입력, 4행 표시 |
| 비교사례 | comparableTransactions | 원본 7P의 사례를 최신 실거래 원본과 대조 후 입력, 5개 사례 + 본건 |
| 담당자 | Settings → BrandProfile | 공통 DA:ON 프로필, 물건별 복제 사용 금지 |

## 연결이 필요한 개별 미디어

계산 대조 주의: 41억 5,000만원 ÷ 50.85평 = 약 8,161.26만원/평이다.
현재 계산 출력(만원 단위 표시)은 8,161만원이며, 원본 이미지의 "약 8,162만원"과 차이가 있다.
출력값을 원본 숫자에 억지로 맞추지 않고 기준 면적·반올림 규칙을 확인한 뒤 확정한다.

- 대표 외관 원본: 외관으로 분류 후 mainImage 또는 PropertyMedia 대표 지정.
- 위치지도 원본: 지도 슬롯에 연결, 크롭하지 않고 contain.
- 측면/코너, 도로, 주변 상권, 교통/랜드마크: caption과 분류를 개별 저장.
- 계단·사무실·지하·화장실·기타 내부사진: 보고서 사용 불가.
- 기존 `/daon-master/bangbae-815-11-main.jpg`, `...-map.jpg` 경로 파일은 이 Git 체크아웃에 없다.
- 제공된 전체 보고서 이미지를 대표사진/지도 대신 넣지 않는다. 덮인 사진을 임의 복원하거나 생성하지 않는다.

## 검증·반영 순서

1. 기존 Property 및 Data Room 내보내기/백업.
2. 원본 Excel·공적자료·개별 외관/지도와 후보값 대조.
3. 출처, 기준일, 검증 상태를 남기고 불일치값 사용자 확인.
4. 사용자 확정값만 저장. 추출값 자동 덮어쓰기 금지.
5. 새 Snapshot 생성 → 1P/7P 및 모든 미디어 시각 대조 → PDF 인쇄 확인.
6. 실제 원본 폰트·로고·아이콘·페이지 간격 검수 후에만 최종 MASTER lock 승인.

## 참고자료 무결성

- 요약보고서(3).png SHA-256: `1757bf8c060c97f2cc064d22fe7c8e7a1411b6aa9124b976c8dca2e46da89ab8`
- 상세보고서(3).pdf SHA-256: `c896bbd3812799ba21ae2426f4684830ac206ae5d8b1f694059391d3fc04d067`
- DAON_Professional_Report_v1(1).pdf와 성수동 현재 출력 PDF는 오류 재현 참고용이며 Golden Reference가 아니다.

## 외관 원본 확보 및 보정

`KakaoTalk_20260907_161811927_01.jpg`에서 본건 크림색 코너 건물을 확인했다.
신규 보정 자산: `public/daon-master/bangbae-815-11/exterior-retouched-v1.png`.
삼성부동산 상호·전화번호와 전깃줄을 제거했다. 현장 증빙은 원본을 사용한다.
`bangbae-media-mapping.json`에 원본/보정본 해시와 매핑 후보를 남겼다.
다른 붉은 벽돌 건물 사진 및 모든 내부사진은 본건 보고서 자산에 포함하지 않았다.
본건 Data Room에 명시적으로 연결하고 새 Snapshot을 생성한 후 crop 검수할 단계가 남았다.
