// 훈련 세션 composable
//
// 모듈 단위 단일 상태(singleton)를 사용합니다.
// 여러 컴포넌트(뷰, 헤더, 진행 바, 액티비티)가 동일한 세션 상태를 공유하도록 하여
// 진행도/선택/저장 상태가 화면 어디서나 일관되게 표시되도록 합니다.
//
// 본 파일은 UI 상태/목업 저장 로직만 담당합니다.
// 실제 평가/진단/커리큘럼 자동 생성은 수행하지 않습니다.

import { computed, reactive, ref } from 'vue'
import type {
  SavingState,
  TrainingLesson,
  TrainingProgressState,
  TrainingQuestion,
} from '@/types/training'

// ---- 모듈 단위 공유 상태 ----
const progressState = reactive<TrainingProgressState>({
  categoryId: null,
  lessonId: null,
  currentQuestionIndex: 0,
  selectedAnswer: null,
  attemptCount: 0,
  hintLevel: 0,
  completedQuestionIds: [],
  isCurrentCorrect: null,
  isCompleted: false,
  completedAt: null,
})

const currentLesson = ref<TrainingLesson | null>(null)
const savingState = reactive<SavingState>({
  status: 'idle',
  errorMessage: null,
  attemptCount: 0,
})
const isSubmittingAnswer = ref(false)
const currentHint = ref<string | null>(null)

interface AnswerEvaluation {
  readonly attemptNo: number
  readonly correct: boolean
  readonly questionCompleted: boolean
  readonly canRetry: boolean
  readonly hint?: string | null
  readonly correctResponse?: unknown
}

type AnswerEvaluator = (
  answer: string | string[],
  question: TrainingQuestion,
) => Promise<AnswerEvaluation>

type AnswerCompletedHandler = () => Promise<void> | void

let answerEvaluator: AnswerEvaluator | null = null
let answerCompletedHandler: AnswerCompletedHandler | null = null

// 문제별 목업 저장소: 선택한 정답
const storedAnswers = reactive<Record<string, string | string[]>>({})
// 문제별 목업 저장소: 녹음 결과(실제 분석 아님)
const storedRecordings = reactive<
  Record<string, { isMock: boolean; audioUrl: string | null; blob: Blob | null }>
>({})

// ---- 계산된 값 ----
const currentQuestion = computed<TrainingQuestion | null>(() => {
  if (!currentLesson.value) return null
  return currentLesson.value.questions[progressState.currentQuestionIndex] ?? null
})

const totalQuestions = computed(() => currentLesson.value?.questions.length ?? 0)
const currentQuestionNumber = computed(() => progressState.currentQuestionIndex + 1)

// 진행 바 표시용(0~100). 현재까지 완료한 문제 기준.
const progressPercent = computed(() => {
  if (totalQuestions.value === 0) return 0
  const completed = progressState.completedQuestionIds.length
  return (completed / totalQuestions.value) * 100
})

const canSubmit = computed(() => progressState.selectedAnswer !== null)
const hasNextQuestion = computed(() =>
  progressState.currentQuestionIndex < totalQuestions.value - 1,
)
const isSaving = computed(() => savingState.status === 'saving')

const correctAnswerHint = (question: TrainingQuestion): string => {
  const answerIds = Array.isArray(question.answer)
    ? question.answer
    : question.answer.split('|')
  const choices = [
    ...(question.choices ?? []),
    ...(question.replacementChoices ?? []),
  ]
  const labels = answerIds
    .map((answerId) => answerId.split(':').at(-1) ?? answerId)
    .map((answerId) => choices.find((choice) => choice.id === answerId)?.text)
    .filter((label): label is string => Boolean(label))

  if (labels.length > 0) {
    return `정답은 ${labels.join(' → ')}예요. 정답대로 다시 해보세요.`
  }
  const result = question.targetResult ?? question.combined
  return result
    ? `정답은 ${result}예요. 정답대로 다시 해보세요.`
    : '정답 표시를 보고 정답대로 다시 해보세요.'
}

// ---- 액션 ----
// 새 레슨 시작: 이전 정답/녹음/진행도를 모두 초기화(이전 답 리셋).
const startLesson = (lesson: TrainingLesson): void => {
  currentLesson.value = lesson
  progressState.categoryId = lesson.categoryId
  progressState.lessonId = lesson.id
  progressState.currentQuestionIndex = 0
  progressState.selectedAnswer = null
  progressState.attemptCount = 0
  progressState.hintLevel = 0
  progressState.completedQuestionIds = []
  progressState.isCurrentCorrect = null
  progressState.isCompleted = false
  progressState.completedAt = null
  currentHint.value = null

  savingState.status = 'idle'
  savingState.errorMessage = null
  savingState.attemptCount = 0

  Object.keys(storedAnswers).forEach((k) => delete storedAnswers[k])
  Object.keys(storedRecordings).forEach((k) => delete storedRecordings[k])
}

const selectAnswer = (answer: string | string[]): void => {
  if (progressState.isCurrentCorrect === true) return // 이미 맞힌 문제는 잠금
  progressState.selectedAnswer = answer
  // 새로 선택하면 이전 피드백(정답/다시시도) 상태를 초기화
  progressState.isCurrentCorrect = null
}

// 정답 확인(선택형). 맞추면 해당 문제를 완료로 표시하고 정답을 목업 저장소에 보관.
const submitAnswer = async (): Promise<boolean> => {
  const question = currentQuestion.value
  if (!question || progressState.selectedAnswer === null || isSubmittingAnswer.value) return false

  const answer = progressState.selectedAnswer
  if (answerEvaluator) {
    isSubmittingAnswer.value = true
    try {
      const evaluation = await answerEvaluator(answer, question)
      progressState.attemptCount = evaluation.attemptNo
      const shouldRevealCorrectAnswer =
        !evaluation.correct && evaluation.correctResponse !== null
        && evaluation.correctResponse !== undefined
      currentHint.value = evaluation.correct
        ? null
        : shouldRevealCorrectAnswer
          ? correctAnswerHint(question)
          : (evaluation.hint ?? '정답 카드를 살펴봐요.')
      if (evaluation.correct) {
        progressState.isCurrentCorrect = true
        if (!progressState.completedQuestionIds.includes(question.id)) {
          progressState.completedQuestionIds.push(question.id)
        }
        storedAnswers[question.id] = answer
      } else {
        progressState.isCurrentCorrect = false
        progressState.hintLevel = shouldRevealCorrectAnswer
          ? 2
          : Math.max(progressState.hintLevel, 1)
      }
      if (evaluation.questionCompleted) {
        await answerCompletedHandler?.()
      }
      return evaluation.correct
    } finally {
      isSubmittingAnswer.value = false
    }
  }

  const correctAnswer = question.answer
  const isCorrect = Array.isArray(correctAnswer)
    ? Array.isArray(answer) && correctAnswer.every((v, i) => v === answer[i])
    : answer === correctAnswer

  progressState.attemptCount += 1

  if (isCorrect) {
    progressState.isCurrentCorrect = true
    if (!progressState.completedQuestionIds.includes(question.id)) {
      progressState.completedQuestionIds.push(question.id)
    }
    storedAnswers[question.id] = answer
  } else {
    progressState.isCurrentCorrect = false
    currentHint.value = '힌트를 보고 한 번 더 생각해 봐요.'
    if (progressState.attemptCount >= 2) {
      progressState.hintLevel = 2
      currentHint.value = correctAnswerHint(question)
    }
    progressState.hintLevel = Math.max(progressState.hintLevel, 1)
  }

  return isCorrect
}

// 따라 읽기(녹음)는 정답 판별 대신 녹음 완료를 곧 완료로 처리(목업).
const markRecordingComplete = (payload: {
  isMock: boolean
  audioUrl: string | null
  blob?: Blob | null
}): void => {
  const question = currentQuestion.value
  if (!question) return
  progressState.isCurrentCorrect = true
  if (!progressState.completedQuestionIds.includes(question.id)) {
    progressState.completedQuestionIds.push(question.id)
  }
  storedRecordings[question.id] = {
    isMock: payload.isMock,
    audioUrl: payload.audioUrl,
    blob: payload.blob ?? null,
  }
  storedAnswers[question.id] = question.answer
}

const showHint = (): void => {
  progressState.hintLevel = Math.min(progressState.hintLevel + 1, 2)
}

// 다음 문제로 이동. 마지막 문제면 false 반환(상위에서 완료/저장 처리).
const nextQuestion = (): boolean => {
  if (!hasNextQuestion.value) return false
  progressState.currentQuestionIndex += 1
  // 문제 이동 시 선택/시도/힌트/정답 상태 초기화
  progressState.selectedAnswer = null
  progressState.attemptCount = 0
  progressState.hintLevel = 0
  progressState.isCurrentCorrect = null
  currentHint.value = null
  return true
}

// 결과 저장 중에는 입력을 잠급니다. 실제 API 연결 시 같은 로딩 화면 안에서
// 최초 요청과 자동 재시도 2회를 수행하고, 모두 실패한 경우에만 일반 오류를 표시합니다.
const saveResult = async (): Promise<boolean> => {
  if (savingState.status === 'saving') return Promise.resolve(false)

  savingState.status = 'saving'
  savingState.errorMessage = null

  // TODO: 백엔드 연결 시 아래 목업 성공 응답을 최대 3회 API 요청으로 교체합니다.
  const succeeded = await new Promise<boolean>((resolve) => {
    window.setTimeout(() => resolve(true), 700)
  })

  savingState.attemptCount += 1
  if (succeeded) {
    savingState.status = 'success'
    return true
  }

  savingState.status = 'failed'
  savingState.errorMessage = '학습을 마무리하지 못했어. 다시 해보자!'
  return false
}

const completeLesson = (): void => {
  progressState.isCompleted = true
  // 목업 완료 타임스탬프
  progressState.completedAt = new Date().toISOString()
}

const resetSession = (): void => {
  const emptyLesson: TrainingLesson | null = null
  currentLesson.value = emptyLesson
  progressState.categoryId = null
  progressState.lessonId = null
  progressState.currentQuestionIndex = 0
  progressState.selectedAnswer = null
  progressState.attemptCount = 0
  progressState.hintLevel = 0
  progressState.completedQuestionIds = []
  progressState.isCurrentCorrect = null
  currentHint.value = null
  progressState.isCompleted = false
  progressState.completedAt = null

  savingState.status = 'idle'
  savingState.errorMessage = null
  savingState.attemptCount = 0

  Object.keys(storedAnswers).forEach((k) => delete storedAnswers[k])
  Object.keys(storedRecordings).forEach((k) => delete storedRecordings[k])
}

const setAnswerEvaluator = (evaluator: AnswerEvaluator | null): void => {
  answerEvaluator = evaluator
}

const setAnswerCompletedHandler = (handler: AnswerCompletedHandler | null): void => {
  answerCompletedHandler = handler
}

export function useTrainingSession() {
  return {
    // 상태
    progressState,
    currentLesson,
    currentQuestion,
    totalQuestions,
    currentQuestionNumber,
    progressPercent,
    savingState,
    isSaving,
    isSubmittingAnswer,
    currentHint,
    storedAnswers,
    storedRecordings,
    // 계산
    canSubmit,
    hasNextQuestion,
    // 액션
    startLesson,
    selectAnswer,
    submitAnswer,
    setAnswerEvaluator,
    setAnswerCompletedHandler,
    markRecordingComplete,
    showHint,
    nextQuestion,
    saveResult,
    completeLesson,
    resetSession,
  }
}
