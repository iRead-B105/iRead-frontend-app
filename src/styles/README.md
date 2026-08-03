# 아이리드 CSS 수정 안내

Vue 파일 안에 길게 들어 있던 `<style scoped>`를 이 폴더로 모았습니다. 각 Vue 파일에는 어떤 CSS 파일을 사용하는지 한 줄만 남아 있습니다.

제품 전체의 UI 기준은 메인 저장소의 [`docs/product/iread-app-design-guide.md`](../../../../docs/product/iread-app-design-guide.md)를 따릅니다. 이 문서는 CSS 파일 위치와 수정 순서를 설명하는 구현 보조 문서입니다.

## 가장 먼저 볼 파일

| 수정 목적 | 파일 | 주로 바꾸는 값 |
| --- | --- | --- |
| 전체 글꼴·글자 단계·색·간격 | `common/tokens.css` | `--learner-font-*`, `--learner-type-*`, `--learner-color-*` |
| body·버튼 공통 글꼴 | `common/foundation.css` | `body`, `button` |
| CSS 불러오는 순서 | `index.css` | `@import` |
| 브라우저 기본값 초기화 | `common/reset.css` | `body`, `*` |

## 공통 글자 단계

`common/tokens.css`의 아래 숫자를 수정하면 같은 역할의 글자를 한 번에 조절할 수 있습니다.

| 토큰 | 대상 |
| --- | --- |
| `--learner-type-page-title` | 페이지의 가장 큰 제목 |
| `--learner-type-section-title` | 화면 안 구역 제목과 큰 질문 |
| `--learner-type-card-title` | 카드·훈련 이름 |
| `--learner-type-button` | 주요 버튼 |
| `--learner-type-body` | 일반 안내 문장 |
| `--learner-type-caption` | 보조 문구 |
| `--learner-type-reading` | 책 본문과 큰 학습 글자 |

메뉴·제목·버튼은 `--learner-font-display`, 책 본문과 실제 읽기 글자는 `--learner-font-reading`을 사용합니다.

훈련·이야기·실력도전 선택 화면의 바깥 콘텐츠 블록은
`--learner-selection-frame-width`와 `--learner-selection-frame-height`를 함께 사용합니다.
내부 이미지의 원본 비율이나 교체 여부가 이 프레임 크기를 바꾸면 안 됩니다.

## 아동용 선택 문구 원칙

- 주요 선택 카드와 큰 행동 버튼에는 행동 이름만 크고 명확하게 표시합니다.
- 행동 이름 아래에 작은 글씨로 세부 설명이나 같은 뜻의 보조 문구를 추가하지 않습니다.
- 설명이 없으면 행동을 이해할 수 없는 경우에는 작은 캡션을 붙이지 말고, 행동 이름 자체를 아동이 바로 이해할 수 있는 표현으로 고칩니다.
- 꼭 필요한 안내는 선택 카드 안의 작은 글씨가 아니라 화면의 공통 안내 영역이나 별도의 오류·도움말 UI에서 제공합니다.

## 폴더별 담당 화면

### `common`

로그인, 전체 레이아웃, 헤더 등 여러 화면에서 사용하는 UI입니다.

- `LearnerLayout.css`: 학습자 전체 화면과 헤더 아래 콘텐츠 영역
- `LearnerHeader.css`: 프로필, 로고, 시선·마이크·나가기 버튼
- `LoginView.css`: 로그인 화면
- 나머지 파일: 여러 화면에서 재사용하는 작은 컴포넌트

### `training`

일일 커리큘럼, 실제 훈련 공통 프레임, 완료 화면입니다.

- `TrainingCurriculumPath.css`: 날짜, 글자 연습 간판, 진행 게이지, 발판과 경로
- `TrainingHomeView.css`: 커리큘럼 페이지 바깥 배경과 상태 화면
- `TrainingLessonView.css`: 실제 학습 화면 전체 프레임, 상단 뒤로가기와 진행률
- `TrainingCompleteView.css`: 개별 훈련 완료
- `TodayTrainingCompleteView.css`: 오늘 학습 완료
- `activities/`: 첫소리 찾기, 자음 따라가기, 문장 조립 등 각 학습 활동

### `story`

이야기 선택, 읽기, 분기 질문과 이야기 관련 카드입니다.

- `StorySelectionView.css`: 이어 읽기 카드와 다른 책·새로운 책 버튼
- `StoryReaderView.css`: 그림책 본문, 시선 표시, 다음 페이지, 이야기 질문

### `world`

메인 섬과 나의 성장 화면입니다.

- `LearnerHomeView.css`, `IslandMap.css`: 메인 지도
- `GrowthView.css`: 나의 성장
- `StoryFriendCollectionModal.css`: 이야기 친구 수집

### `educator`

교수자 앱과 연결되는 임시 교수자 화면입니다. 아동용 글자 토큰과 섞지 않습니다.

## 안전하게 숫자 바꾸는 순서

1. 먼저 `common/tokens.css`에 같은 역할의 공통 값이 있는지 확인합니다.
2. 한 화면만 바꿀 때는 해당 폴더의 `컴포넌트이름.css`를 수정합니다.
3. `width`, `height`, `top`, `left`, `padding`, `font-size` 바로 위의 주석과 선택자 이름으로 대상을 확인합니다.
4. F11 기준 `1920×1200`과 최소 기준 `1280×800`에서 확인합니다.
5. 마지막에 `npm run build`를 실행합니다.

Vue 파일에서 CSS 위치를 찾고 싶으면 파일 맨 아래의 다음 한 줄을 확인하면 됩니다.

```vue
<style scoped src="@/styles/분류/컴포넌트이름.css"></style>
```
