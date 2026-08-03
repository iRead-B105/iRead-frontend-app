<script setup lang="ts">
// 훈련 레슨 화면: 문제 풀이 → 결과 저장
// 세션 상태는 useTrainingSession(싱글톤)에서 공유합니다.
// 액티비티는 'next' 이벤트만 보내며, 다음 레슨으로의 이동/자동 진행은 이곳에서 처리합니다.
// (향후 자동 커리큘럼 연결 시 이 지점의 goNext/finish 흐름을 서버 세션 기반으로 교체)
//
// 본 화면은 "메인 섬 화면"처럼 요소를 최소로 유지합니다.

import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import type { TrainingActivityType, TrainingLesson } from '@/types/training'
import { getLessonById } from '@/mocks/trainingLessons'
import { useDailyCurriculum } from '@/composables/useDailyCurriculum'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { useDeviceStatus } from '@/composables/useDeviceStatus'
import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import { useDeveloperMode } from '@/composables/useDeveloperMode'
import {
  getSkillChallengeLessons,
  isSkillChallengeTrackId,
  useSkillChallenge,
} from '@/composables/useSkillChallenge'
import { trainingActivityComponents } from '@/components/training/activityRegistry'
import LearningBackButton from '@/components/training/LearningBackButton.vue'
import LearningNextButton from '@/components/training/LearningNextButton.vue'
import leaveTrainingRabbit from '@/assets/training/ui/leave-training-rabbit.png'
import lessonProgressTitleBoard from '@/assets/training/ui/lesson-progress-title-board-compact.webp'
import eyeTrackerIcon from '@/assets/icons/eye-tracker.svg'
import microphoneIcon from '@/assets/icons/microphone.svg'
import { learnerDataSource } from '@/config/learnerDataSource'
import {
  learnerTrainingRepository,
  createRealGazeSubmission,
  buildTrainingResponse,
  createMockGazeSubmission,
  createMockVoiceFile,
  mapTrainingQuestion,
  mockGazeSubmissionsEnabled,
  mockVoiceSubmissionsEnabled,
  type LearnerTraceSubmissionResponse,
  type LearnerTrainingIntro,
  type MappedTrainingQuestion,
  type DeviceGazeSample,
} from '@/features/learner/training'
import { getCachedStudent } from '@/services/learnerDataRepository'
import { useLearnerErrorModalStore } from '@/stores/learnerErrorModal'
import { learnerGazeRepository } from '@/features/learner/gaze'
import { learnerTestRepository } from '@/features/learner/test'
import { presentTrainingHint } from '@/features/learner/training/hintPresentation'
import { isApiError } from '@/lib/api'

const route = useRoute()
const router = useRouter()
const session = useTrainingSession()
const dailyCurriculum = useDailyCurriculum()
const skillChallenge = useSkillChallenge()
const errorModal = useLearnerErrorModalStore()
const { eyeTrackerConnected, virtualEyeTrackerConnected, microphoneAvailable } = useDeviceStatus()
const voiceRecorder = useVoiceRecorder()
const {
  enabled: isDeveloperMode,
  latestVoiceScore,
  recordVoiceScore,
  clearVoiceScore,
} = useDeveloperMode()

const debugMode = computed(() => import.meta.env.DEV && route.query.debug === '1')
const challengeTrackId = computed(() => {
  const value = String(route.params.trackId ?? route.query.challenge ?? '')
  return isSkillChallengeTrackId(value) ? value : null
})
const challengePresentation = computed(() =>
  challengeTrackId.value
    ? getSkillChallengeLessons(challengeTrackId.value).find(
      (item) => item.lessonId === String(route.params.lessonId ?? ''),
    ) ?? getSkillChallengeLessons(challengeTrackId.value)[0] ?? null
    : null,
)
const categoryId = computed(() => String(
  route.params.categoryId ?? challengePresentation.value?.categoryId ?? '',
))
const lessonId = computed(() => String(
  route.params.lessonId ?? challengePresentation.value?.lessonId ?? '',
))
const learningRepository = computed(() =>
  challengeTrackId.value ? learnerTestRepository : learnerTrainingRepository,
)
const learningItemId = computed(() => String(
  challengeTrackId.value
    ? route.params.testId ?? route.query.testId ?? ''
    : route.query.trainingId ?? '',
))

const fallbackLesson = computed(() => getLessonById(lessonId.value))
const serverLesson = ref<TrainingLesson | null>(null)
const lesson = computed(() =>
  learnerDataSource === 'api' && !debugMode.value ? serverLesson.value : fallbackLesson.value,
)
const serverIntro = ref<LearnerTrainingIntro | null>(null)
const serverQuestions = ref<readonly MappedTrainingQuestion[]>([])
const startingTraining = ref(false)
const submittingQuestion = ref(false)
const voiceGateOpen = ref(false)
const voiceSubmitting = ref(false)
const voiceAttemptLimitReached = ref(false)
const voiceCompleted = ref(false)
const voiceFeedback = ref('')
const advanceAfterAutomaticVoice = ref(false)
const pendingNextResponse = ref<LearnerTraceSubmissionResponse | undefined>()
const recordedQuestionNumbers = new Set<number>()
const gazeSessionId = ref<string | null>(null)
const gazeSessionCompleted = ref(false)
const gazeSamples: DeviceGazeSample[] = []
type GazeWordHit = {
  readonly clientX: number
  readonly clientY: number
  readonly capturedAtMs: number
  readonly questionNumber: number
  readonly tokenIndex: number
  readonly text: string
}
let lastGazeWordHit: GazeWordHit | null = null
let lastCursorGazeSampleAt = 0
const gazeDebugVisible = computed(() =>
  route.query.gazeDebug === '1'
  || import.meta.env.VITE_GAZE_DEBUG_PANEL === 'true',
)
const gazeTransferDebug = ref({
  source: mockGazeSubmissionsEnabled ? 'mock' : 'real',
  start: 'idle',
  end: 'idle',
  sessionId: '',
  sampleCount: 0,
  lastSampleAt: '',
  lastError: '',
})
// 구현된 액티비티 컴포넌트만 매핑. 준비 중 유형은 여기 없으며(도달 불가),
// 향후 추가 시 이 맵에만 등록하면 됩니다.
const activityComponent = computed<Component | null>(() =>
  lesson.value ? (trainingActivityComponents[lesson.value.activityType] ?? null) : null,
)

type Phase = 'intro' | 'playing' | 'saving'
const phase = ref<Phase>('intro')
const deviceBlocker = ref<'eye-tracker' | 'microphone' | null>(null)
const microphoneRetrying = ref(false)
const leaveConfirmationOpen = ref(false)
const integrationError = ref('')
let resolveLeaveConfirmation: ((allow: boolean) => void) | null = null
let automaticVoiceStopTimer: ReturnType<typeof setTimeout> | null = null

watch(integrationError, (error) => {
  if (!error) return
  errorModal.show(error, '훈련 연결 오류')
  void router.replace({ name: challengeTrackId.value ? 'skill-challenge' : 'training-home' })
})

const gazeRequiredActivities = new Set<TrainingActivityType>([
  'gaze-trace',
  'word-reading-grid',
])
const microphoneRequiredActivities = new Set<TrainingActivityType>([
  'gaze-trace',
  'word-reading-grid',
])
const gazeRequired = computed(() =>
  learnerDataSource === 'api'
    ? serverQuestions.value.some((question) => question.requiredInputs.includes('GAZE'))
    : lesson.value
      ? gazeRequiredActivities.has(lesson.value.activityType)
      : false,
)
const microphoneRequired = computed(() =>
  learnerDataSource === 'api'
    ? serverQuestions.value.some((question) => question.requiredInputs.includes('VOICE'))
    : lesson.value
      ? microphoneRequiredActivities.has(lesson.value.activityType)
      : false,
)
const currentQuestionRequiresMicrophone = computed(() =>
  learnerDataSource === 'api'
    ? serverQuestions.value[session.progressState.currentQuestionIndex]?.requiredInputs.includes('VOICE') === true
    : microphoneRequired.value,
)

const currentQuestion = computed(() => session.currentQuestion.value)
const questionScroll = ref<HTMLElement | null>(null)
const sharedNextEnabled = computed(() =>
  session.progressState.isCurrentCorrect === true || voiceAttemptLimitReached.value,
)
type ActivityLayout = 'trace-speak' | 'choice' | 'manipulation' | 'reading-speak'
const activityLayouts: Record<TrainingActivityType, ActivityLayout> = {
  'gaze-trace': 'trace-speak',
  'audio-letter-choice': 'choice',
  'listen-and-select': 'choice',
  'sound-choice': 'choice',
  'sentence-choice': 'choice',
  'letter-build': 'manipulation',
  'sound-manipulation': 'manipulation',
  'sound-omit': 'manipulation',
  'sound-blend': 'manipulation',
  'fill-blank': 'manipulation',
  'sentence-order': 'manipulation',
  'word-reading-grid': 'reading-speak',
  'card-match': 'choice',
  'drag-and-drop': 'manipulation',
}
const activityLayoutClass = computed(() =>
  lesson.value
    ? `activity-layout--${activityLayouts[lesson.value.activityType]}`
    : undefined,
)
const conciseInstructions: Partial<Record<TrainingActivityType, string>> = {
  'gaze-trace': '글자를 따라 읽어요!',
  'audio-letter-choice': '첫소리를 찾아봐!',
  'listen-and-select': '비슷한 소리를 찾아봐!',
  'sound-choice': '소리를 찾아봐!',
  'letter-build': '소리 듣고 글자를 만들어봐!',
  'sound-manipulation': '낱말을 바꿔봐!',
  'sound-omit': '잘 듣고 글자를 잘라봐!',
  'sound-blend': '소리를 합쳐봐!',
  'word-reading-grid': '낱말을 읽어봐!',
  'sentence-choice': '맞는 문장을 찾아봐!',
  'fill-blank': '빈칸을 채워봐!',
  'sentence-order': '문장을 만들어봐!',
}
const mockListeningPromptLessonIds = new Set([
  'repeat-sentence',
  'follow-sentence',
])
const displayQuestion = computed(() => {
  const question = currentQuestion.value
  if (!question || !lesson.value) return question
  return {
    ...question,
    audioPromptEnabled:
      question.audioPromptEnabled
      ?? mockListeningPromptLessonIds.has(lesson.value.id),
    requiredInputs: learnerDataSource === 'api'
      ? serverQuestions.value[session.progressState.currentQuestionIndex]?.requiredInputs
      : undefined,
    instruction: lesson.value.activityType === 'gaze-trace'
      ? conciseInstructions['gaze-trace']
      : question.instruction.length <= 14
      ? question.instruction.replace(/[.!?]+$/, '')
      : (conciseInstructions[lesson.value.activityType] ?? '해봐요'),
    subInstruction: undefined,
  }
})
const displayedHint = computed(() => presentTrainingHint(
  lesson.value?.activityType,
  session.currentHint.value,
  session.progressState.hintLevel,
))
const voiceDeviceFallbackEnabled = mockVoiceSubmissionsEnabled
const cursorGazeFallbackEnabled = import.meta.env.VITE_CURSOR_GAZE_FALLBACK !== 'false'
const gazeDeviceFallbackEnabled = mockGazeSubmissionsEnabled || cursorGazeFallbackEnabled

const gazeTransferSource = () => {
  if (mockGazeSubmissionsEnabled) return 'mock'
  if (!eyeTrackerConnected.value && cursorGazeFallbackEnabled) return 'cursor'
  return 'real'
}

const updateGazeTransferDebug = (patch: Partial<typeof gazeTransferDebug.value>) => {
  gazeTransferDebug.value = {
    ...gazeTransferDebug.value,
    ...patch,
    sampleCount: gazeSamples.length,
    source: gazeTransferSource(),
  }
  window.localStorage.setItem(
    'iread-gaze-transfer-debug',
    JSON.stringify(gazeTransferDebug.value),
  )
}

const recentHitMatchesSample = (
  hit: GazeWordHit | null,
  sample: Pick<DeviceGazeSample, 'x' | 'y' | 'capturedAtMs' | 'questionNumber'>,
) => {
  if (!hit || hit.questionNumber !== sample.questionNumber) return false
  if (Math.abs(hit.capturedAtMs - sample.capturedAtMs) > 160) return false
  return Math.hypot(hit.clientX - sample.x, hit.clientY - sample.y) <= 48
}

const gazeMetricTokensFrom = (value: string | null | undefined): string[] =>
  value?.match(/[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]+/g) ?? []

const normalizeGazeToken = (value: string) =>
  value.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}ㄱ-ㅎㅏ-ㅣ가-힣]/gu, '')

const uiTokensForQuestion = (mapped: MappedTrainingQuestion): string[] => {
  if (mapped.question.readingSentences?.length) {
    return mapped.question.readingSentences.flatMap((sentence) => sentence.chunks)
  }
  if (mapped.question.readingWords?.length) {
    return mapped.question.readingWords.map((word) => word.text)
  }
  return gazeMetricTokensFrom(
    mapped.expectedText
    ?? mapped.question.targetText
    ?? mapped.question.targetResult,
  )
}

const metricTokensForQuestion = (mapped: MappedTrainingQuestion): string[] => {
  const expectedTokens = gazeMetricTokensFrom(mapped.expectedText)
  if (expectedTokens.length > 0) return expectedTokens
  return uiTokensForQuestion(mapped)
}

const resolveMetricTokenIndex = (mapped: MappedTrainingQuestion, hit: GazeWordHit) => {
  const metricTokens = metricTokensForQuestion(mapped)
  const uiTokens = uiTokensForQuestion(mapped)
  const normalizedHit = normalizeGazeToken(hit.text)
  const uiOccurrence = uiTokens
    .slice(0, hit.tokenIndex + 1)
    .filter((token) => normalizeGazeToken(token) === normalizedHit)
    .length
  if (uiOccurrence > 0) {
    let metricOccurrence = 0
    const matchedIndex = metricTokens.findIndex((token) => {
      if (normalizeGazeToken(token) !== normalizedHit) return false
      metricOccurrence += 1
      return metricOccurrence === uiOccurrence
    })
    if (matchedIndex >= 0) return matchedIndex
  }
  if (normalizeGazeToken(metricTokens[hit.tokenIndex] ?? '') === normalizedHit) {
    return hit.tokenIndex
  }
  const fallbackIndex = metricTokens.findIndex((token) => normalizeGazeToken(token) === normalizedHit)
  return fallbackIndex >= 0 ? fallbackIndex : hit.tokenIndex
}

const applyWordHitToSample = (sample: DeviceGazeSample, hit: GazeWordHit): DeviceGazeSample => {
  const mapped = serverQuestions.value[session.progressState.currentQuestionIndex]
  const tokenIndex = mapped ? resolveMetricTokenIndex(mapped, hit) : hit.tokenIndex
  const text = mapped
    ? metricTokensForQuestion(mapped)[tokenIndex] ?? hit.text
    : hit.text
  return {
    ...sample,
    targetIndex: mapped?.recordingTargetIndex ?? 0,
    tokenIndex,
    text,
  }
}

const attachWordHitToRecentSample = (hit: GazeWordHit) => {
  for (let index = gazeSamples.length - 1; index >= Math.max(0, gazeSamples.length - 8); index -= 1) {
    const sample = gazeSamples[index]
    if (!sample || sample.tokenIndex !== undefined || !recentHitMatchesSample(hit, sample)) continue
    gazeSamples[index] = applyWordHitToSample(sample, hit)
    return true
  }
  return false
}

const appendCursorGazeSampleFromHit = (hit: GazeWordHit) => {
  if (!cursorGazeFallbackEnabled || eyeTrackerConnected.value) return
  if (hit.capturedAtMs - lastCursorGazeSampleAt < 80) return
  lastCursorGazeSampleAt = hit.capturedAtMs
  const sample: DeviceGazeSample = {
    x: hit.clientX,
    y: hit.clientY,
    capturedAtMs: hit.capturedAtMs,
    questionNumber: hit.questionNumber,
  }
  gazeSamples.push(applyWordHitToSample(sample, hit))
  updateGazeTransferDebug({ lastSampleAt: new Date().toLocaleTimeString() })
}

const onGazeSample = (event: Event) => {
  if (phase.value !== 'playing' || !gazeSessionId.value) return
  const detail = (event as CustomEvent<Record<string, unknown>>).detail
  const x = Number(detail?.x ?? detail?.clientX)
  const y = Number(detail?.y ?? detail?.clientY)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  const sample: DeviceGazeSample = {
    x,
    y,
    capturedAtMs: Date.now(),
    questionNumber: session.currentQuestionNumber.value,
  }
  const matchingHit = recentHitMatchesSample(lastGazeWordHit, sample)
    ? lastGazeWordHit
    : null
  gazeSamples.push(matchingHit ? applyWordHitToSample(sample, matchingHit) : sample)
  updateGazeTransferDebug({ lastSampleAt: new Date().toLocaleTimeString() })
}

const onGazeWordHit = (event: Event) => {
  if (phase.value !== 'playing' || !gazeSessionId.value) return
  const detail = (event as CustomEvent<Record<string, unknown>>).detail
  const clientX = Number(detail?.clientX)
  const clientY = Number(detail?.clientY)
  const tokenIndex = Number(detail?.tokenIndex)
  const text = typeof detail?.text === 'string' ? detail.text : ''
  if (
    !Number.isFinite(clientX)
    || !Number.isFinite(clientY)
    || !Number.isInteger(tokenIndex)
    || tokenIndex < 0
    || text.trim() === ''
  ) return
  lastGazeWordHit = {
    clientX,
    clientY,
    capturedAtMs: Date.now(),
    questionNumber: session.currentQuestionNumber.value,
    tokenIndex,
    text,
  }
  if (!attachWordHitToRecentSample(lastGazeWordHit)) {
    appendCursorGazeSampleFromHit(lastGazeWordHit)
  }
}

onMounted(async () => {
  window.addEventListener('iread:gaze', onGazeSample)
  window.addEventListener('iread:gaze-word-hit', onGazeWordHit)
  if (challengeTrackId.value) {
    skillChallenge.ensureChallenge(challengeTrackId.value, lessonId.value)
  }
  // 세션 초기화 및 첫 문제 준비(이전 정답/녹음은 모두 리셋)
  if ((learnerDataSource === 'mock' || debugMode.value) && fallbackLesson.value) {
    session.startLesson(fallbackLesson.value)
  }
  if (learnerDataSource === 'api' && !debugMode.value) {
    const itemId = learningItemId.value
    if (!/^\d+$/.test(itemId)) {
      integrationError.value = '서버 학습 ID가 없어 학습을 시작할 수 없습니다.'
    } else {
      try {
        const studentId = getCachedStudent().studentId
        const intro = await learningRepository.value.getIntro(studentId, itemId)
        if (intro.status === 'COMPLETED') {
          await router.replace({ name: challengeTrackId.value ? 'skill-challenge' : 'training-home' })
          return
        }
        const firstPayload = await learningRepository.value.getQuestion(studentId, itemId, 1)
        const remainingPayloads = await Promise.all(
          Array.from(
            { length: Math.max(firstPayload.totalQuestions - 1, 0) },
            (_, index) => learningRepository.value.getQuestion(
              studentId,
              itemId,
              index + 2,
            ),
          ),
        )
        const mappedQuestions = [firstPayload, ...remainingPayloads].map(mapTrainingQuestion)
        const activityType = mappedQuestions[0]?.activityType
        if (
          !activityType
          || mappedQuestions.some((question) => question.activityType !== activityType)
        ) {
          throw new TypeError('한 훈련 안의 문항 화면 유형이 서로 다릅니다.')
        }
        const presentation = fallbackLesson.value
        const loadedLesson: TrainingLesson = {
          id: lessonId.value,
          categoryId: presentation?.categoryId ?? 'phonics',
          title: intro.trainingName,
          description: presentation?.description ?? '오늘의 맞춤 훈련을 시작해요.',
          activityType,
          estimatedMinutes: presentation?.estimatedMinutes ?? 5,
          questions: mappedQuestions.map((question) => question.question),
        }
        serverIntro.value = intro
        serverQuestions.value = mappedQuestions
        serverLesson.value = loadedLesson
        session.startLesson(loadedLesson)
        session.restoreProgress(intro.completedQuestionNumbers)
        session.setAnswerEvaluator(async (answer) => {
          const mapped = serverQuestions.value[session.progressState.currentQuestionIndex]
          if (!mapped || ['TRACE', 'AUDIO'].includes(mapped.responseType)) {
            throw new Error('이 문항은 선택 응답으로 제출할 수 없습니다.')
          }
          try {
            const feedback = await learningRepository.value.saveSubmission(
              studentId,
              itemId,
              mapped.questionNumber,
              {
                submissionId: crypto.randomUUID(),
                responseType: mapped.responseType,
                response: buildTrainingResponse(mapped, answer),
              },
            )
            return feedback
          } catch (error) {
            errorModal.show(
              error instanceof Error ? error : new Error('훈련 답안을 저장하지 못했습니다.'),
              '훈련 제출 오류',
            )
            return {
              attemptNo: session.progressState.attemptCount,
              correct: false,
              questionCompleted: false,
              canRetry: true,
              hint: null,
            }
          }
        })
        session.setAnswerCompletedHandler(
          challengeTrackId.value
            ? () => goNext()
            : null,
        )
      } catch (error) {
        integrationError.value =
          error instanceof Error ? error.message : '서버 훈련 정보를 불러오지 못했습니다.'
      }
    }
  }
  if (debugMode.value) {
    phase.value = 'playing'
  } else if (!integrationError.value) {
    await startPlaying()
  }
})

const startPlaying = async () => {
  if (integrationError.value || startingTraining.value) return
  if (!gazeDeviceFallbackEnabled && gazeRequired.value && !eyeTrackerConnected.value) {
    deviceBlocker.value = 'eye-tracker'
    return
  }
  if (!voiceDeviceFallbackEnabled && microphoneRequired.value && !microphoneAvailable.value) {
    deviceBlocker.value = 'microphone'
    return
  }
  startingTraining.value = true
  try {
    if (learnerDataSource === 'api' && !debugMode.value) {
      const intro = serverIntro.value
      const itemId = learningItemId.value
      if (!intro || !/^\d+$/.test(itemId)) {
        throw new Error('서버 훈련 정보를 확인할 수 없습니다.')
      }
      if (intro.status === 'NOT_STARTED') {
        await learningRepository.value.start(getCachedStudent().studentId, itemId)
        serverIntro.value = { ...intro, status: 'IN_PROGRESS' }
      } else if (intro.status !== 'IN_PROGRESS') {
        throw new Error(`시작할 수 없는 훈련 상태입니다: ${intro.status}`)
      }
      try {
        await learningRepository.value.resetPronunciationAttempts(
          getCachedStudent().studentId,
          itemId,
        )
      } catch (resetError) {
        console.warn('발음 시도 초기화에 실패했습니다.', resetError)
      }
      if (
        serverQuestions.value.some((question) => question.requiredInputs.includes('GAZE'))
        && !gazeSessionId.value
      ) {
        updateGazeTransferDebug({ start: 'sending', lastError: '' })
        const gazeSession = await learnerGazeRepository.start({
          studentId: getCachedStudent().studentId,
          contentType: challengeTrackId.value ? 'TEST' : 'TRAINING',
          ...(challengeTrackId.value ? { testId: itemId } : { trainingId: itemId }),
          calibrationStatus:
            mockGazeSubmissionsEnabled || virtualEyeTrackerConnected.value
              ? 'SKIPPED'
              : eyeTrackerConnected.value
                ? 'SUCCESS'
                : 'SKIPPED',
        })
        gazeSessionId.value = gazeSession.gazeSessionId
        updateGazeTransferDebug({
          start: 'sent',
          sessionId: gazeSession.gazeSessionId,
        })
      }
    }
    phase.value = 'playing'
    if (
      learnerDataSource === 'api'
      && !debugMode.value
      && !mockVoiceSubmissionsEnabled
      && currentQuestionRequiresMicrophone.value
      && session.progressState.isCurrentCorrect !== true
    ) {
      voiceRecorder.reset()
      voiceGateOpen.value = true
      voiceFeedback.value = '준비되면 말하기 버튼을 눌러 주세요.'
    }
  } catch (error) {
    integrationError.value =
      error instanceof Error ? error.message : '서버 훈련을 시작하지 못했습니다.'
  } finally {
    startingTraining.value = false
  }
}

onBeforeRouteLeave(() => {
  if (debugMode.value) return true
  if (phase.value === 'intro' || session.progressState.isCompleted) return true

  leaveConfirmationOpen.value = true
  return new Promise<boolean>((resolve) => {
    resolveLeaveConfirmation?.(false)
    resolveLeaveConfirmation = resolve
  })
})

const finishLeaveConfirmation = (allow: boolean) => {
  leaveConfirmationOpen.value = false
  resolveLeaveConfirmation?.(allow)
  resolveLeaveConfirmation = null
}

onBeforeUnmount(() => {
  clearAutomaticVoiceTimers()
  window.removeEventListener('iread:gaze', onGazeSample)
  window.removeEventListener('iread:gaze-word-hit', onGazeWordHit)
  if (gazeSessionId.value && !gazeSessionCompleted.value) {
    void learnerGazeRepository.fail(
      gazeSessionId.value,
      getCachedStudent().studentId,
    )
  }
  session.setAnswerEvaluator(null)
  session.setAnswerCompletedHandler(null)
  resolveLeaveConfirmation?.(false)
  resolveLeaveConfirmation = null
})

watch(
  [eyeTrackerConnected, microphoneAvailable, phase, () => session.progressState.isCompleted],
  ([eyeConnected, micAvailable, currentPhase, completed]) => {
    if (debugMode.value) {
      deviceBlocker.value = null
      return
    }
    const gazeBlockerResolved = deviceBlocker.value === 'eye-tracker'
      && (gazeDeviceFallbackEnabled || eyeConnected)
    const microphoneBlockerResolved = deviceBlocker.value === 'microphone'
      && (voiceDeviceFallbackEnabled || micAvailable)
    if (gazeBlockerResolved || microphoneBlockerResolved) {
      deviceBlocker.value = null
      if (phase.value === 'intro') void startPlaying()
    }

    if (currentPhase !== 'playing' || completed) {
      deviceBlocker.value = null
      return
    }
    if (!gazeDeviceFallbackEnabled && gazeRequired.value && !eyeConnected) deviceBlocker.value = 'eye-tracker'
    else if (!voiceDeviceFallbackEnabled && currentQuestionRequiresMicrophone.value && !micAvailable) deviceBlocker.value = 'microphone'
  },
)

const exitToHome = () => {
  if (debugMode.value) {
    void router.push({ name: 'training-home', query: { debugPanel: '1' } })
    return
  }
  void router.push({ name: challengeTrackId.value ? 'skill-challenge' : 'training-home' })
}

const activateSharedNext = () => {
  if (!sharedNextEnabled.value) return
  const source = questionScroll.value?.querySelector<HTMLButtonElement>(
    'button.shared-next-source',
  )
  if (source && !source.disabled) {
    source.click()
    return
  }
  void goNext()
}

const submitMockVoice = async (
  mapped: MappedTrainingQuestion,
  itemId: string,
): Promise<void> => {
  if (!mapped.expectedText) {
    throw new Error('목 음성 제출에 필요한 읽기 문구가 없습니다.')
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await learningRepository.value.saveRecording(
      getCachedStudent().studentId,
      itemId,
      mapped.questionNumber,
      {
        targetIndex: mapped.recordingTargetIndex ?? undefined,
        expectedText: mapped.expectedText,
        audioFile: createMockVoiceFile(mapped.questionNumber),
      },
    )
    if (!result.canRetry) {
      recordedQuestionNumbers.add(mapped.questionNumber)
      return
    }
  }
  throw new Error('목 음성 제출을 완료하지 못했습니다.')
}

// 다음 문제로 이동. 마지막 문제면 결과 저장 흐름으로 진입.
const clearAutomaticVoiceTimers = () => {
  if (automaticVoiceStopTimer) clearTimeout(automaticVoiceStopTimer)
  automaticVoiceStopTimer = null
}

const beginAutomaticVoiceCapture = async (
  response?: LearnerTraceSubmissionResponse,
  advanceAfterSubmit = true,
) => {
  if (
    voiceSubmitting.value
    || voiceRecorder.state.status === 'requesting'
    || voiceRecorder.state.status === 'recording'
  ) return

  const questionIndex = session.progressState.currentQuestionIndex
  const mapped = serverQuestions.value[questionIndex]
  if (!mapped?.expectedText) {
    errorModal.show(
      new Error('음성 평가에 필요한 읽기 문구가 없어요.'),
      '음성 평가 오류',
    )
    return
  }

  clearAutomaticVoiceTimers()
  pendingNextResponse.value = response
  advanceAfterAutomaticVoice.value = advanceAfterSubmit
  voiceFeedback.value = '준비되면 바로 말해요!'
  voiceRecorder.reset()
  voiceGateOpen.value = true
  await voiceRecorder.start()

  if (
    phase.value !== 'playing'
    || session.progressState.isCompleted
    || session.progressState.currentQuestionIndex !== questionIndex
  ) {
    voiceRecorder.reset()
    voiceGateOpen.value = false
    deviceBlocker.value = null
    return
  }

  const recorderStatus = voiceRecorder.state.status as string
  if (recorderStatus !== 'recording') {
    voiceGateOpen.value = false
    deviceBlocker.value = 'microphone'
    return
  }

  voiceFeedback.value = '듣고 있어요!'
  const recordingMs = Math.min(
    12_000,
    Math.max(3_000, mapped.expectedText.length * 650 + 1_800),
  )
  automaticVoiceStopTimer = setTimeout(() => voiceRecorder.stop(), recordingMs)
}

const enableMicrophoneFromBlocker = async () => {
  if (deviceBlocker.value !== 'microphone' || microphoneRetrying.value) return

  microphoneRetrying.value = true
  try {
    const available = await voiceRecorder.checkAccess()
    if (!available) {
      deviceBlocker.value = 'microphone'
      return
    }

    deviceBlocker.value = null
    if (
      phase.value === 'playing'
      && !session.progressState.isCompleted
      && currentQuestionRequiresMicrophone.value
    ) {
      voiceGateOpen.value = true
      voiceFeedback.value = '준비되면 말하기 버튼을 눌러 주세요.'
      return
    }

    if (phase.value === 'intro') await startPlaying()
  } finally {
    microphoneRetrying.value = false
  }
}

const restartAutomaticVoiceCapture = () => {
  void beginAutomaticVoiceCapture(
    pendingNextResponse.value,
    advanceAfterAutomaticVoice.value,
  )
}

const goNext = async (response?: LearnerTraceSubmissionResponse) => {
  if (submittingQuestion.value) return
  if (learnerDataSource === 'api' && !debugMode.value) {
    const mapped = serverQuestions.value[session.progressState.currentQuestionIndex]
    if (
      mapped?.requiredInputs.includes('VOICE')
      && !recordedQuestionNumbers.has(mapped.questionNumber)
      && !mockVoiceSubmissionsEnabled
    ) {
      pendingNextResponse.value = response
      // 액티비티에서 이미 읽은 음성이 있으면 같은 문장을 다시 읽히지 않는다.
      const captured = session.storedRecordings[mapped.question.id]?.blob ?? null
      if (captured) {
        await submitRecordedVoice(mapped, captured)
        return
      }
      await beginAutomaticVoiceCapture(response)
      return
    }
  }
  submittingQuestion.value = true
  try {
    if (learnerDataSource === 'api' && !debugMode.value) {
      const itemId = learningItemId.value
      const mapped = serverQuestions.value[session.progressState.currentQuestionIndex]
      if (!mapped || !/^\d+$/.test(itemId)) {
        throw new Error('제출할 서버 훈련 문항을 확인할 수 없습니다.')
      }
      if (
        mockVoiceSubmissionsEnabled
        && mapped.requiredInputs.includes('VOICE')
        && !recordedQuestionNumbers.has(mapped.questionNumber)
      ) {
        await submitMockVoice(mapped, itemId)
      }
      if (mapped.responseType === 'TRACE') {
        if (!response) throw new Error('시선 따라가기 결과가 없습니다.')
        const feedback = await learningRepository.value.saveSubmission(
          getCachedStudent().studentId,
          itemId,
          mapped.questionNumber,
          {
            submissionId: crypto.randomUUID(),
            responseType: mapped.responseType,
            response: { ...response },
          },
        )
        if (!feedback.questionCompleted) {
          throw new Error('문항이 아직 완료되지 않았습니다.')
        }
      }
    }

    const hasMore = session.nextQuestion()
    if (!hasMore) await saveAndFinish()
  } catch (error) {
    errorModal.show(
      error instanceof Error ? error : new Error('훈련 응답을 저장하지 못했습니다.'),
      '훈련 제출 오류',
    )
  } finally {
    submittingQuestion.value = false
  }
}

type ActivityVoiceEvaluationControls = {
  success: (message?: string) => void
  retry: (message?: string) => void
}

const isPronunciationAttemptLimitError = (error: unknown): boolean =>
  isApiError(error)
  && error.status === 409
  && error.message.includes('발음 문항의 최대 시도 횟수')

// 따라 읽기 액티비티에서 수음한 음성을 즉시 백엔드 발음 평가로 보낸다.
// 성공한 문항 번호를 기록해 다음 버튼에서 같은 음성을 다시 요구하지 않는다.
const evaluateActivityVoice = async (
  blob: Blob,
  controls: ActivityVoiceEvaluationControls,
) => {
  const mapped = serverQuestions.value[session.progressState.currentQuestionIndex]
  const itemId = learningItemId.value

  if (learnerDataSource !== 'api' || debugMode.value) {
    controls.success()
    return
  }
  if (!mapped?.expectedText || !/^\d+$/.test(itemId)) {
    controls.retry('음성 평가 정보를 확인할 수 없어요. 다시 말해 주세요.')
    return
  }

  voiceSubmitting.value = true
  try {
    const extension = blob.type.includes('mp4') ? 'm4a' : 'webm'
    const result = await learningRepository.value.saveRecording(
      getCachedStudent().studentId,
      itemId,
      mapped.questionNumber,
      {
        targetIndex: mapped.recordingTargetIndex ?? undefined,
        expectedText: mapped.expectedText,
        audioFile: new File([blob], `training-${mapped.questionNumber}.${extension}`, {
          type: blob.type || 'audio/webm',
        }),
      },
    )
    const score = Math.round(result.pronunciationAccuracyScore)
    recordVoiceScore({
      score,
      threshold: Math.round(result.pronunciationThreshold),
      passed: result.passed,
      canRetry: result.canRetry,
      expectedText: mapped.expectedText,
      questionNumber: mapped.questionNumber,
    })
    if (result.canRetry) {
      controls.retry(`${score}점이에요. 한 번 더 또박또박 읽어봐요!`)
      return
    }

    recordedQuestionNumbers.add(mapped.questionNumber)
    controls.success(
      result.passed
        ? `${score}점! 또박또박 잘 읽었어!`
        : '끝까지 읽었어! 다음 글자도 연습해보자!',
    )
  } catch (error) {
    if (isPronunciationAttemptLimitError(error)) {
      recordedQuestionNumbers.add(mapped.questionNumber)
      controls.success('끝까지 잘 했어요! 다음 문제로 넘어가요.')
      return
    }
    controls.retry(
      error instanceof Error
        ? error.message
        : '목소리를 확인하지 못했어요. 다시 말해 주세요.',
    )
  } finally {
    voiceSubmitting.value = false
  }
}

const submitVoiceRecording = async () => {
  const mapped = serverQuestions.value[session.progressState.currentQuestionIndex]
  const blob = voiceRecorder.audioBlob.value
  if (!mapped || !blob) {
    voiceFeedback.value = '녹음 정보를 확인할 수 없습니다.'
    return
  }
  await submitRecordedVoice(mapped, blob)
}

// 액티비티에서 담아 둔 녹음과 게이트에서 다시 받은 녹음을 같은 경로로 올린다.
const submitRecordedVoice = async (
  mapped: MappedTrainingQuestion,
  blob: Blob,
) => {
  const itemId = learningItemId.value
  if (!mapped.expectedText || !/^\d+$/.test(itemId)) {
    voiceFeedback.value = '녹음 정보를 확인할 수 없습니다.'
    voiceRecorder.reset()
    voiceGateOpen.value = true
    return
  }
  voiceSubmitting.value = true
  try {
    const extension = blob.type.includes('mp4') ? 'm4a' : 'webm'
    const result = await learningRepository.value.saveRecording(
      getCachedStudent().studentId,
      itemId,
      mapped.questionNumber,
      {
        targetIndex: mapped.recordingTargetIndex ?? undefined,
        expectedText: mapped.expectedText,
        audioFile: new File([blob], `training-${mapped.questionNumber}.${extension}`, {
          type: blob.type || 'audio/webm',
        }),
      },
    )
    recordVoiceScore({
      score: Math.round(result.pronunciationAccuracyScore),
      threshold: Math.round(result.pronunciationThreshold),
      passed: result.passed,
      canRetry: result.canRetry,
      expectedText: mapped.expectedText,
      questionNumber: mapped.questionNumber,
    })
    voiceFeedback.value = challengeTrackId.value
      ? '목소리를 잘 저장했어요.'
      : result.passed
        ? `${Math.round(result.pronunciationAccuracyScore)}점! 잘 읽었어요.`
        : `${Math.round(result.pronunciationAccuracyScore)}점이에요. ${
          result.canRetry
            ? `${result.pronunciationThreshold}점 이상을 목표로 한 번 더 읽어봐요.`
            : '힌트를 보고 연습을 마쳤어요.'
        }`
    if (result.canRetry) {
      voiceRecorder.reset()
      voiceGateOpen.value = true
      return
    }
    recordedQuestionNumbers.add(mapped.questionNumber)
    voiceCompleted.value = true
    voiceGateOpen.value = false
    const pending = pendingNextResponse.value
    pendingNextResponse.value = undefined
    if (advanceAfterAutomaticVoice.value) await goNext(pending)
  } catch (error) {
    if (isPronunciationAttemptLimitError(error)) {
      recordedQuestionNumbers.add(mapped.questionNumber)
      voiceAttemptLimitReached.value = true
      voiceFeedback.value = '끝까지 잘 했어요! 다음 문제로 넘어가요.'
      voiceGateOpen.value = false
      voiceRecorder.reset()
      const pending = pendingNextResponse.value
      pendingNextResponse.value = undefined
      if (advanceAfterAutomaticVoice.value) await goNext(pending)
      return
    }
    voiceFeedback.value = error instanceof Error ? error.message : '녹음을 저장하지 못했습니다.'
    voiceRecorder.reset()
    voiceGateOpen.value = true
  } finally {
    voiceSubmitting.value = false
  }
}

// 결과 저장 중에는 기술 용어 없이 마무리 로딩만 보여줍니다.
watch(() => voiceRecorder.state.status, (status) => {
  if (!voiceGateOpen.value || status !== 'recorded' || voiceSubmitting.value) return
  clearAutomaticVoiceTimers()
  if (
    voiceRecorder.voiceActivityDetectionAvailable.value
    && !voiceRecorder.hasDetectedVoice.value
  ) {
    voiceFeedback.value = '목소리가 들리지 않았어요. 말하기 버튼을 눌러 주세요.'
    voiceRecorder.reset()
    return
  }
  void submitVoiceRecording()
})

watch(() => session.progressState.currentQuestionIndex, () => {
  clearAutomaticVoiceTimers()
  voiceRecorder.reset()
  clearVoiceScore()
  voiceAttemptLimitReached.value = false
  voiceCompleted.value = false
  voiceGateOpen.value = (
    phase.value === 'playing'
    && learnerDataSource === 'api'
    && !debugMode.value
    && !mockVoiceSubmissionsEnabled
    && currentQuestionRequiresMicrophone.value
  )
  if (voiceGateOpen.value) {
    voiceFeedback.value = '준비되면 말하기 버튼을 눌러 주세요.'
  }
})

// 조작형 학습은 정답을 완성하는 즉시 화면 안에서 발음을 받는다.
// 다음 버튼이 녹음 모달을 여는 흐름을 없애고, 녹음 완료 뒤에도 현재 문항을 유지한다.
watch(
  [sharedNextEnabled, () => session.progressState.currentQuestionIndex],
  ([correct]) => {
    if (!correct || learnerDataSource !== 'api' || debugMode.value || mockVoiceSubmissionsEnabled) return
    const mapped = serverQuestions.value[session.progressState.currentQuestionIndex]
    if (
      !mapped?.requiredInputs.includes('VOICE')
      || recordedQuestionNumbers.has(mapped.questionNumber)
      || voiceGateOpen.value
    ) return
    const captured = session.storedRecordings[mapped.question.id]?.blob ?? null
    if (captured) {
      advanceAfterAutomaticVoice.value = false
      void submitRecordedVoice(mapped, captured)
      return
    }
    pendingNextResponse.value = undefined
    advanceAfterAutomaticVoice.value = false
    voiceRecorder.reset()
    voiceGateOpen.value = true
    voiceFeedback.value = '준비되면 말하기 버튼을 눌러 주세요.'
  },
)

const saveAndFinish = async () => {
  clearAutomaticVoiceTimers()
  voiceGateOpen.value = false
  voiceAttemptLimitReached.value = false
  voiceCompleted.value = false
  deviceBlocker.value = null
  voiceRecorder.reset()
  phase.value = 'saving'
  let ok = false
  let nextCurriculumItem: (typeof dailyCurriculum.curriculumItems)[number] | null = null
  if (learnerDataSource === 'api' && !debugMode.value) {
    session.savingState.status = 'saving'
    session.savingState.errorMessage = null
    try {
      const itemId = learningItemId.value
      if (!/^\d+$/.test(itemId)) throw new Error('서버 학습 ID가 올바르지 않습니다.')
      if (gazeSessionId.value && !gazeSessionCompleted.value) {
        const gazeData = mockGazeSubmissionsEnabled
          ? createMockGazeSubmission(serverQuestions.value)
          : createRealGazeSubmission(serverQuestions.value, gazeSamples)
        updateGazeTransferDebug({ end: 'sending', lastError: '' })
        await learnerGazeRepository.end(
          gazeSessionId.value,
          getCachedStudent().studentId,
          'COMPLETED',
          gazeData,
        )
        gazeSessionCompleted.value = true
        updateGazeTransferDebug({ end: 'sent' })
      }
      if (!challengeTrackId.value) {
        await dailyCurriculum.loadCurrentCurriculum()
      }
      const completedCurriculumId = dailyCurriculum.curriculumId.value
      await learningRepository.value.complete(getCachedStudent().studentId, itemId)
      if (!challengeTrackId.value) {
        await dailyCurriculum.reloadCurrentCurriculum()
        nextCurriculumItem = dailyCurriculum.curriculumId.value === completedCurriculumId
          ? dailyCurriculum.curriculumItems[dailyCurriculum.currentIndex.value] ?? null
          : null
      }
      session.savingState.status = 'success'
      ok = true
    } catch (error) {
      updateGazeTransferDebug({
        lastError: error instanceof Error ? error.message : 'gaze 전송 확인 중 오류가 발생했습니다.',
      })
      session.savingState.status = 'failed'
      session.savingState.errorMessage =
        error instanceof Error ? error.message : '학습을 마무리하지 못했습니다.'
    }
  } else {
    ok = await session.saveResult()
    if (ok && !challengeTrackId.value) {
      nextCurriculumItem = dailyCurriculum.markLessonComplete(lessonId.value)
    }
  }
  if (ok) {
    session.completeLesson()
    if (debugMode.value) {
      void router.replace({ name: 'training-home', query: { debugPanel: '1' } })
      return
    }
    void router.replace(
      challengeTrackId.value
        ? {
          name: 'skill-challenge-question-complete',
          params: {
            trackId: challengeTrackId.value,
            testId: learningItemId.value,
          },
          query: { lessonId: lessonId.value },
        }
        : nextCurriculumItem
          ? {
            name: 'training-lesson',
            params: {
              categoryId: nextCurriculumItem.categoryId,
              lessonId: nextCurriculumItem.lesson.id,
            },
            query: { trainingId: nextCurriculumItem.trainingId },
          }
          : { name: 'training-today-complete' },
    )
  }
  // 실패 시 phase 는 'saving' 유지 → 저장 오버레이에서 재시도 버튼 노출
}

const isSavingFailed = computed(() => session.savingState.status === 'failed')
</script>

<template>
  <div class="lesson-view">
    <!-- 문제 풀이 -->
    <div
      v-if="phase === 'playing' && lesson"
      class="playing"
      :class="{ 'playing--first-sound': lesson.id === 'word-first-sound-choice' }"
    >
      <div class="lesson-topbar lesson-topbar--inside">
        <LearningBackButton @back="exitToHome" />
        <section
          v-if="displayQuestion"
          class="lesson-progress-board"
          role="status"
          :aria-label="`${displayQuestion.instruction}. 현재 ${session.currentQuestionNumber.value}번, 전체 ${session.totalQuestions.value}문제`"
        >
          <img
            class="lesson-progress-board-image"
            :src="lessonProgressTitleBoard"
            alt=""
            aria-hidden="true"
          />
          <div class="lesson-progress-board-content">
            <div class="lesson-progress-copy">
              <div class="topbar-progress">
                <strong>{{ session.currentQuestionNumber.value }} / {{ session.totalQuestions.value }}</strong>
                <span class="topbar-progress-dots" aria-hidden="true">
                  <span
                    v-for="i in session.totalQuestions.value"
                    :key="i"
                    class="prog-dot"
                    :class="{
                      active: i <= session.currentQuestionNumber.value,
                      current: i === session.currentQuestionNumber.value,
                    }"
                  ></span>
                </span>
              </div>
              <h1 class="learner-instruction lesson-instruction">
                {{ displayQuestion.instruction }}
              </h1>
            </div>
          </div>
        </section>
        <LearningNextButton
          :enabled="sharedNextEnabled"
          @activate="activateSharedNext"
        />
      </div>
      <div ref="questionScroll" class="question-scroll" :class="activityLayoutClass">
        <component
          :is="activityComponent"
          v-if="displayQuestion && activityComponent"
          :key="displayQuestion.id"
          :question="displayQuestion"
          @next="goNext"
          @voice-recorded="evaluateActivityVoice"
        />
        <Transition name="fade">
          <aside
            v-if="voiceGateOpen || voiceAttemptLimitReached || voiceCompleted"
            class="inline-voice-panel"
            :class="{
              'inline-voice-panel--ready': voiceRecorder.state.status === 'idle' && !voiceAttemptLimitReached && !voiceCompleted,
              'inline-voice-panel--listening': voiceRecorder.state.status === 'recording',
              'inline-voice-panel--complete': voiceAttemptLimitReached || voiceCompleted,
            }"
            :aria-label="voiceAttemptLimitReached || voiceCompleted
              ? '발음 연습 완료'
              : voiceRecorder.state.status === 'recording'
                ? '목소리 인식 중'
                : '목소리 녹음 준비'"
            aria-live="polite"
          >
            <span
              class="inline-voice-icon"
              :class="{ 'inline-voice-icon--listening': voiceRecorder.state.status === 'recording' }"
              aria-hidden="true"
            >
              <img :src="microphoneIcon" alt="" />
            </span>
            <strong class="inline-voice-title">
              {{ voiceAttemptLimitReached || voiceCompleted
                ? '참 잘했어요!'
                : voiceRecorder.state.status === 'recording'
                  ? '듣고 있어요!'
                  : '말할 준비가 됐어요' }}
            </strong>
            <p class="inline-voice-feedback" role="status">{{ voiceFeedback }}</p>
            <button
              v-if="voiceRecorder.state.status === 'idle' && !voiceAttemptLimitReached && !voiceCompleted"
              class="inline-voice-retry"
              type="button"
              @click="restartAutomaticVoiceCapture"
            >
              말하기
            </button>
            <div
              v-if="isDeveloperMode && latestVoiceScore"
              class="developer-voice-score"
              :class="{ passed: latestVoiceScore.passed, failed: !latestVoiceScore.passed }"
            >
              <strong>{{ latestVoiceScore.score }}점</strong>
              <span>기준 {{ latestVoiceScore.threshold }}점</span>
              <small>
                {{ latestVoiceScore.expectedText }} · {{ latestVoiceScore.passed ? '통과' : '재시도' }}
              </small>
            </div>
          </aside>
        </Transition>
        <aside
          v-if="isDeveloperMode && latestVoiceScore && !voiceGateOpen"
          class="developer-voice-score developer-voice-score--overlay"
          :class="{ passed: latestVoiceScore.passed, failed: !latestVoiceScore.passed }"
          aria-live="polite"
        >
          <strong>{{ latestVoiceScore.score }}점</strong>
          <span>기준 {{ latestVoiceScore.threshold }}점</span>
          <small>
            {{ latestVoiceScore.expectedText }} · {{ latestVoiceScore.passed ? '통과' : '재시도' }}
          </small>
        </aside>
      </div>
    </div>

    <!-- 저장 오버레이(저장 중 입력 잠금) -->
    <Transition name="fade">
      <div v-if="phase === 'saving'" class="saving-overlay" role="status" aria-live="polite">
        <div class="saving-panel">
          <template v-if="!isSavingFailed">
            <span class="saving-spinner" aria-hidden="true"></span>
            <p class="saving-text">학습을 마무리하고 있어요</p>
          </template>
          <template v-else>
            <p class="saving-icon" aria-hidden="true">!</p>
            <p class="saving-text">{{ session.savingState.errorMessage }}</p>
            <button class="retry-button" type="button" @click="saveAndFinish">다시 시도할래요</button>
          </template>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div
        v-if="deviceBlocker && phase === 'playing' && !session.progressState.isCompleted"
        class="device-blocker"
        role="alertdialog"
        aria-modal="true"
        :aria-labelledby="`${deviceBlocker}-title`"
      >
        <section class="device-blocker-panel">
          <span class="device-blocker-icon" aria-hidden="true">
            <img
              :src="deviceBlocker === 'eye-tracker' ? eyeTrackerIcon : microphoneIcon"
              alt=""
            />
          </span>
          <h2 :id="`${deviceBlocker}-title`">
            {{ deviceBlocker === 'eye-tracker' ? '아이트래커를 연결해 주세요' : '마이크를 켜 주세요' }}
          </h2>
          <p v-if="deviceBlocker === 'eye-tracker' || voiceRecorder.state.errorMessage">
            {{ deviceBlocker === 'eye-tracker'
              ? '이 훈련은 눈으로 따라가는 활동이에요.'
              : voiceRecorder.state.errorMessage }}
          </p>
          <div class="device-blocker-actions">
            <button
              v-if="deviceBlocker === 'microphone'"
              type="button"
              :disabled="microphoneRetrying"
              @click="enableMicrophoneFromBlocker"
            >
              {{ microphoneRetrying ? '마이크 확인 중…' : '마이크 켜기' }}
            </button>
            <button
              class="device-blocker-secondary"
              type="button"
              @click="exitToHome"
            >
              뒤로가기
            </button>
          </div>
        </section>
      </div>
    </Transition>

    <Transition name="fade">
      <div
        v-if="leaveConfirmationOpen"
        class="leave-confirmation"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="leave-confirmation-title"
      >
        <section class="leave-confirmation-panel">
          <img class="leave-confirmation-image" :src="leaveTrainingRabbit" alt="" aria-hidden="true" />
          <h2 id="leave-confirmation-title">학습을 그만할까?</h2>
          <p>나가면 이 훈련은 다음에 처음부터 다시 시작해.</p>
          <div>
            <button
              class="leave-confirmation-cancel"
              type="button"
              @click="finishLeaveConfirmation(false)"
            >
              계속 학습하기
            </button>
            <button
              class="leave-confirmation-confirm"
              type="button"
              @click="finishLeaveConfirmation(true)"
            >
              그만하고 나가기
            </button>
          </div>
        </section>
      </div>
    </Transition>

    <aside v-if="gazeDebugVisible" class="gaze-debug-panel" aria-live="polite">
      <strong>Gaze transfer</strong>
      <dl>
        <div>
          <dt>source</dt>
          <dd>{{ gazeTransferDebug.source }}</dd>
        </div>
        <div>
          <dt>start</dt>
          <dd>{{ gazeTransferDebug.start }}</dd>
        </div>
        <div>
          <dt>end</dt>
          <dd>{{ gazeTransferDebug.end }}</dd>
        </div>
        <div>
          <dt>session</dt>
          <dd>{{ gazeTransferDebug.sessionId || '-' }}</dd>
        </div>
        <div>
          <dt>samples</dt>
          <dd>{{ gazeTransferDebug.sampleCount }}</dd>
        </div>
        <div>
          <dt>last</dt>
          <dd>{{ gazeTransferDebug.lastSampleAt || '-' }}</dd>
        </div>
      </dl>
      <p v-if="gazeTransferDebug.lastError">{{ gazeTransferDebug.lastError }}</p>
    </aside>

    <!-- 폴백: 알 수 없는 레슨 -->
    <div v-if="!lesson" class="fallback">
      <p>레슨을 불러올 수 없어요.</p>
      <button class="retry-button" type="button" @click="exitToHome">훈련 선택으로 가기</button>
    </div>
  </div>
</template>

<style scoped src="@/styles/training/TrainingLessonView.css"></style>
