# Real Estate Report

IndexedDB에 물건 데이터를 저장하고 보고서·제안서·입지브리핑을 만드는 로컬 MVP입니다.

## 개발 실행

```bash
npm run dev
```

이 명령은 프론트엔드 `http://localhost:5174`와 지도 API proxy `http://localhost:5175`를 함께 실행합니다. 필요하면 `npm run dev:proxy`, `npm run dev:frontend` 순서로 별도 실행할 수 있습니다. Vite는 `/api` 요청만 5175로 전달하며 GPS Tracker의 5173은 사용하지 않습니다.

## 지도 API 설정

프로젝트 루트의 `.env`에 서버 전용 키를 입력합니다.

```env
NAVER_MAP_CLIENT_ID=
NAVER_MAP_CLIENT_SECRET=
KAKAO_REST_API_KEY=
VITE_KAKAO_JAVASCRIPT_KEY=
```

기존 `VITE_` 변수로 키가 들어 있다면 `npm run migrate:env`를 한 번 실행합니다. 이 작업은 변수명만 이전하며 키 값을 출력하지 않습니다. `.env`는 `.gitignore`로 제외됩니다.

브라우저는 NAVER/Kakao REST API를 직접 호출하지 않습니다. Provider들은 기존 인터페이스를 유지하면서 로컬 `/api/maps/geocode`, `/api/maps/static`, `/api/poi/search`만 호출합니다. NAVER는 주소·정적 지도의 우선 Provider이고 Kakao 지도 구현은 fallback으로 유지됩니다.

## 건물 외관 확인

현행 NAVER Maps JavaScript SDK에서 Panorama 생성자가 제공되지 않아 NAVER는 Geocoding과 Static Map 역할만 담당합니다. 외관 확인은 Kakao Roadview가 기본 Provider이며 REST 키와 별개인 브라우저 SDK용 `VITE_KAKAO_JAVASCRIPT_KEY`를 사용합니다. Kakao Developers Web 플랫폼에는 `http://localhost:5174`를 허용 도메인으로 등록해야 합니다. NAVER Client ID·Secret과 Kakao REST 키는 5175 proxy 전용이며 브라우저에 전달되지 않습니다.

거리뷰는 외관 확인용 DOM 뷰어로만 표시합니다. 앱은 거리뷰 이미지 다운로드·스크린샷·캐시·대표사진 자동 복사를 수행하지 않으며, 사용자가 확인을 기록하면 Provider, panoId, 촬영일(제공 시), 확인시각만 Property에 저장합니다.

운영 배포에서는 로컬 proxy를 접근 제어가 적용된 backend 또는 serverless API로 교체해야 합니다.
