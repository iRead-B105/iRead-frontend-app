// 훈련 화면 타입 정의
// 본 파일은 UI / 목업 데이터 / 세션 로직 / 오디오 / 녹음 로직에서 공통으로 사용합니다.

// 훈련 대분류 4가지
export type TrainingCategoryId =
  | 'phonological-awareness' // 음운 인식 훈련
  | 'phonics' // 파닉스 훈련
  | 'short-text' // 짧은 글 훈련
  | 'fluency' // 유창성 훈련

// 액티비티 유형(각 레슨이 화면에 문제를 어떻게 보여줄지 결정)
// 실제 컴포넌트가 구현된 유형과 향후 확장용 유형을 함께 정의합니다.
export type TrainingActivityType =
  | 'listen-and-select' // 소리 듣고 카드/글자 선택 (예: 첫소리 찾기)
  | 'audio-letter-choice' // 소리만 듣고 글자 카드 3개 중 하나를 즉시 선택
  | 'gaze-trace' // 시선으로 획순을 따라가고 소리 내어 읽기
  | 'letter-build' // 소리를 듣고 자모 카드를 빈칸에 끌어 글자 만들기
  | 'sound-manipulation' // 소리 단위를 클릭해 탈락시키거나 다른 소리로 대치
  | 'hangul-battle' // 캐릭터와 제한 시간 없이 먼저 낱말을 조합하는 배틀
  | 'word-reading-grid' // 2×2 낱말을 시선과 음성으로 차례대로 읽기
  | 'sentence-reading' // 한 문장을 어절 순서대로 시선과 음성으로 읽기
  | 'sound-choice' // 대상 글자를 숨기고 소리만 듣고 선택
  | 'sound-omit' // 원래 낱말에서 한 음절을 빼 목표 낱말 만들기
  | 'sound-blend' // 나뉜 음절 소리 카드를 낱말로 합치기
  | 'card-combine' // 자음 + 모음 카드 합치기
  | 'sentence-choice' // 그림에 맞는 문장 선택
  | 'read-aloud' // 문장 따라 읽기(녹음)
  | 'card-match' // (준비 중) 그림-글자 카드 짝찾기
  | 'drag-and-drop' // (준비 중) 끌어다 놓기
  | 'sentence-order' // (준비 중) 문장 순서 맞추기
  | 'fill-blank' // (준비 중) 빈칸 채우기

// 한글 자모 카드 한 장
export interface HangulLetter {
  jamo: string // 예: 'ㄱ', 'ㅏ'
  type: 'consonant' | 'vowel'
}

// 훈련 대분류
export interface TrainingCategory {
  id: TrainingCategoryId
  title: string
  description: string
  image: string // 대분류 아이콘(기존 에셋)
  lessons: TrainingLessonSummary[]
}

// 서브메뉴에 보여질 레슨 요약
export interface TrainingLessonSummary {
  id: string
  categoryId: TrainingCategoryId
  title: string
  description: string
  activityType: TrainingActivityType
  estimatedMinutes: number
  thumbnail?: string
  // 현재 목업에서 플레이 가능한 레슨인지 여부.
  // false 인 레슨은 "이 훈련은 준비하고 있어요." 메시지를 보여줍니다.
  isReady: boolean
}

// 플레이 가능한 레슨의 전체 데이터(문제 포함)
export interface TrainingLesson {
  id: string
  categoryId: TrainingCategoryId
  title: string
  description: string
  activityType: TrainingActivityType
  estimatedMinutes: number
  questions: TrainingQuestion[]
}

// 어려운 단어 음절 분리 예시(예: 고양이가 → 고/양/이/가)
export interface WordBreakdown {
  word: string
  syllables: string[]
}

export interface TracePoint {
  x: number
  y: number
}

export interface LetterBuildSlot {
  id: string
  role: 'initial' | 'medial' | 'final'
  answerChoiceId: string
  hintText: string
}

export interface SoundManipulationUnit {
  id: string
  text: string
}

export interface HangulBattleTile {
  id: string
  text: string
}

export interface HangulBattleRound {
  id: string
  word: string
  answer: string[]
  tiles: HangulBattleTile[]
  opponentDurationMs: number
}

export interface WordReadingItem {
  id: string
  text: string
  speechAliases?: string[]
}

export interface ReadingSentence {
  id: string
  chunks: string[]
}

// 선택지 카드(글자/문장/음절)
export interface TrainingChoice {
  id: string
  text?: string
  letter?: HangulLetter // 글자 카드 선택지(첫소리 찾기 등)
  audioSrc?: string
  imageUrl?: string
}

// 2단계 힌트
export interface TrainingHint {
  level1?: string
  level2?: string
  highlightChoiceId?: string
}

// 친절한 피드백 문구(부정형 표현 금지)
export interface TrainingFeedback {
  correct: string
  retry: string
  completed?: string
}

// 문제 1개
export interface TrainingQuestion {
  id: string
  instruction: string
  subInstruction?: string
  // 공통: 정답 선택지 id
  answer: string

  // listen-and-select / sentence-choice
  targetText?: string // 들려줄 단어/문장
  audioText?: string // 화면에 노출하지 않고 들려줄 소리/낱말
  targetSound?: string // 강조 소리(예: 첫소리 'ㄱ')
  targetImage?: string // 대상 그림(없으면 리소스 추가 필요)
  targetSymbol?: string // 관련 이미지 에셋이 없을 때 쓰는 목업용 의미 기호
  targetImageLabel?: string // 리소스 추가 필요 코멘트용 설명
  choices?: TrainingChoice[]
  choiceAudioEnabled?: boolean
  soundParts?: string[] // 소리 탈락의 원 낱말 또는 합성할 음절 단위
  traceGlyph?: string // 시선으로 따라 볼 한글 자모 또는 음절
  traceStrokes?: TracePoint[][] // 획순대로 정렬된 시선 체크포인트
  speechAliases?: string[] // STT가 허용할 발음 표기 변형
  buildSlots?: LetterBuildSlot[] // 글자 만들기 빈칸과 정답 카드 연결
  manipulationMode?: 'remove' | 'replace'
  manipulationUnits?: SoundManipulationUnit[]
  manipulationTargetUnitIds?: string[]
  manipulationAnswerSets?: string[][] // 같은 결과가 되는 복수 정답(예: 같은 '나' 중 하나 빼기)
  replacementChoices?: TrainingChoice[]
  replacementAnswerId?: string
  targetResult?: string
  battleOpponent?: 'rabbit' | 'turtle' | 'ant'
  battleRounds?: HangulBattleRound[]
  readingWords?: WordReadingItem[]
  readingSentences?: ReadingSentence[]

  // card-combine 전용
  consonant?: string // 예: 'ㄱ'
  vowel?: string // 예: 'ㅏ'
  combined?: string // 예: '가'

  // sentence-choice 전용: 어려운 단어 음절 분리
  focusWord?: WordBreakdown

  // read-aloud 전용: 끊어 읽기 단위
  phraseChunks?: string[]

  hint?: TrainingHint
  feedback?: TrainingFeedback
}

// 세션 진행 상태(학습자가 현재 어디까지 풀었는지)
export interface TrainingProgressState {
  categoryId: TrainingCategoryId | null
  lessonId: string | null
  currentQuestionIndex: number
  selectedAnswer: string | string[] | null
  attemptCount: number
  hintLevel: number // 0 ~ 2
  completedQuestionIds: string[]
  incorrectQuestionIds: string[]
  isCurrentCorrect: boolean | null
  isCompleted: boolean
  completedAt: string | null // 목업 완료 타임스탬프
}

// 녹음 상태
export type RecordingStatus =
  | 'idle' // 대기
  | 'requesting' // 마이크 권한 요청 중
  | 'recording' // 녹음 중
  | 'recorded' // 녹음 완료
  | 'unsupported' // MediaRecorder 미지원(목업 녹음)
  | 'denied' // 마이크 권한 거부

export interface RecordingState {
  status: RecordingStatus
  elapsedMs: number
  isMock: boolean // 실제 분석이 아닌 목업 녹음 여부
  hasRecording: boolean
  errorMessage: string | null
}

// 결과 저장 상태
export type SavingStatus = 'idle' | 'saving' | 'success' | 'failed'

export interface SavingState {
  status: SavingStatus
  errorMessage: string | null
  attemptCount: number
}
