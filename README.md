# iRead Learner App

iRead 아동용 Vue 애플리케이션입니다. 교수자용 `frontend-web`과 분리된 서브모듈이며
Spring Boot의 `/api/auth/app/**`, `/api/app/**` 계약을 사용합니다.

## 실행

```powershell
npm install
$env:VITE_LEARNER_DATA_SOURCE='mock'
npm run dev
```

Backend API와 연결할 때는 Spring Boot를 `8080`에서 실행한 뒤 다음과 같이 시작합니다.

```powershell
$env:VITE_LEARNER_DATA_SOURCE='api'
$env:VITE_API_BASE_URL=''
$env:VITE_BACKEND_URL='http://127.0.0.1:8080'
npm run dev
```

- `mock`이 기본값이며 UI 자체 검증에 사용합니다.
- `api` 모드의 실패나 미확정 계약은 mock 성공으로 자동 대체하지 않습니다.
- 로컬 eye tracker bridge는 `ws://127.0.0.1:8765/gaze`를 사용합니다.

## 검증

```powershell
npm run type-check
npm test
npm run build
```
