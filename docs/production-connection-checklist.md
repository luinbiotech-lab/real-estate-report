# DA:ON Production Connection Checklist

이 문서는 local-first 구현 완료 후 실제 외부 인프라를 연결할 때의 실행 순서다.

## 0. 사전 원칙

- 기존 GPS Tracker / Sports-AI Supabase 프로젝트를 재사용하지 않는다.
- 부동산 전용 backend/Auth 프로젝트를 별도로 사용한다.
- 유료 리소스 생성 또는 요금제 변경은 사용자 승인 후 진행한다.
- `service_role`, NAVER secret, Kakao REST key 등 서버 전용 secret은 브라우저 bundle에 넣지 않는다.
- 실제 backend가 연결되기 전에는 public URL, remote revoke, RLS가 동작하는 것처럼 표시하지 않는다.

## 1. 신규 Backend 프로젝트 준비

- [ ] 부동산 전용 프로젝트 생성
- [ ] 프로젝트 URL / public client key 확보
- [ ] server-only credential은 protected environment에 저장
- [ ] production / preview 환경 분리 여부 결정
- [ ] 비용/쿼터 확인

## 2. Auth + Profiles + RLS

적용 준비 파일:

- `supabase/migrations/20260916_auth_profiles_rls.sql`
- `src/services/authProviderService.ts`

순서:

1. migration 검토
2. 전용 부동산 DB에만 적용
3. 첫 OWNER는 trusted admin/server path로 bootstrap
4. 테스트 사용자 viewer 생성
5. OWNER / ADMIN / EDITOR / VIEWER 권한 회귀검증
6. self-promotion 차단 확인
7. inactive user 접근차단 확인
8. multi-device session 확인

완료 조건:

- `REMOTE AUTH = CONNECTED`
- 실제 로그인 session 존재
- OWNER-only user administration 강제
- 데이터 테이블 RLS까지 실제 적용

## 3. Remote / Public External Share

적용 준비 파일:

- `supabase/migrations/20260915_external_public_share.sql`
- `src/services/remoteExternalShareGateway.ts`
- `src/services/externalShareProviderService.ts`

보안 조건:

- raw token DB 저장 금지
- token hash만 저장
- public request는 server-side token validation 필수
- expiry / revoke는 서버 시각 기준
- external review note도 token 검증 후 저장

완료 조건:

- 실제 public URL 발급
- 만료 후 접근 차단
- revoke 즉시 외부 접근 차단
- download policy 강제
- review note 서버 동기화

## 4. Production Frontend / Protected Proxy

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
- [ ] CORS / origin 제한
- [ ] rate limit / abuse guard 검토

## 5. Provider Domain Allowlist

- [ ] NAVER production domain 등록
- [ ] Kakao production domain 등록
- [ ] Kakao JavaScript SDK origin 확인
- [ ] localhost 개발 도메인과 production 도메인 분리 확인

## 6. Production E2E

필수 시나리오:

1. OWNER 로그인
2. 물건 생성/수정
3. Data Room 문서/미디어 업로드
4. Verification 생성
5. Report Snapshot 생성
6. 외부 public share 생성
7. 익명/검토자 public URL 접근
8. 만료 테스트
9. remote revoke 테스트
10. review note 동기화
11. 다른 device에서 동일 데이터 확인
12. backup export 확인
13. 기존 DAON MASTER render regression 확인

## 7. 배포 승인 Gate

다음이 모두 충족되어야 Production READY로 본다.

- [ ] Auth backend CONNECTED
- [ ] RLS 실제 적용 및 테스트
- [ ] Remote Public Share CONNECTED
- [ ] Production frontend host LIVE
- [ ] Protected backend proxy LIVE
- [ ] Provider allowlist 완료
- [ ] server secret browser 미노출 확인
- [ ] Typecheck PASS
- [ ] Lint PASS
- [ ] Build PASS
- [ ] GitHub Actions 전체 PASS
- [ ] Production E2E PASS

## 현재 상태 확인

```bash
npm run readiness:prod
```

현재 미연결 항목이 `NOT_CONFIGURED`, `MISSING_EXTERNAL_INFRA`, `CHECK_REQUIRED`로 표시되는 것은 정상이다. 실제 외부 리소스가 연결된 이후에만 READY로 승격한다.
