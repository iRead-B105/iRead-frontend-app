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
import { useDailyCurriculum } from '@/composables/useDailyCurriculum'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { useDeviceStatus } from '@/composables/useDeviceStatus'
import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import { useDeveloperMode } from '@/composables/useDeveloperMode'
import {
  getSkillChallengeLessons,
  isSkillChallengeTrackId,
} from '@/composables/useSkillChallenge'
import { trainingActivityComponents } from '@/components/training/activityRegistry'
import LearningBackButton from '@/components/training/LearningBackButton.vue'
import LearningNextButton from '@/components/training/LearningNextButton.vue'
import leaveTrainingRabbit from '@/assets/training/ui/leave-training-rabbit.png'
import lessonProgressTitleBoard from '@/assets/training/ui/lesson-progress-title-board-compact.webp'
import eyeTrackerIcon from '@/assets/icons/eye-tracker.svg'
import microphoneIcon from '@/assets/icons/microphone.svg'
import {
  learnerTrainingRepository,
  buildTrainingResponse,
  mapTrainingQuestion,
  type LearnerTraceSubmissionResponse,
  type LearnerTrainingIntro,
  type MappedTrainingQuestion,
} from '@/features/learner/training'
import {
  createGazeSubmission,
  type DeviceGazeSample,
} from '@/features/learner/training/gazeSubmission'
import { getCachedStudent } from '@/services/learnerDataRepository'
import { useLearnerErrorModalStore } from '@/stores/learnerErrorModal'
import { useLearnerSessionStore } from '@/stores/learnerSession'
import { learnerGazeRepository } from '@/features/learner/gaze'
import { learnerTestRepository } from '@/features/learner/test'
import { presentTrainingHint } from '@/features/learner/training/hintPresentation'
import { getTrainingTemplateMapping } from '@/features/learner/content/trainingTemplateMapping'
import { isApiError } from '@/lib/api'
import { cursorGazeFallbackEnabled } from '@/lib/cursorGazeFallback'

const route = useRoute()
const router = useRouter()
const session = useTrainingSession()
const dailyCurriculum = useDailyCurriculum()
const errorModal = useLearnerErrorModalStore()
const learnerSession = useLearnerSessionStore()
const { eyeTrackerConnected, virtualEyeTrackerConnected, microphoneAvailable } = useDeviceStatus()
const voiceRecorder = useVoiceRecorder()
const {
  enabled: isDeveloperMode,
  latestVoiceScore,
  recordVoiceScore,
  clearVoiceScore,
  pushDevGaze,
} = useDeveloperMode()

const challengeTrackId = computed(() => {
  const value = String(route.params.trackId ?? route.query.challenge ?? '')
  return isSkillChallengeTrackId(value) ? value : null
})
// 검사(실력 검증)는 틀린 응답도 기록만 하고 재시도 없이 진행한다. 액티비티들이 세션으로 이 모드를 읽는다.
watch(challengeTrackId, (value) => session.setAssessmentMode(Boolean(value)), { immediate: true })
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

const serverLesson = ref<TrainingLesson | null>(null)
const lesson = computed(() => serverLesson.value)
const serverIntro = ref<LearnerTrainingIntro | null>(null)
const serverQuestions = ref<readonly MappedTrainingQuestion[]>([])
const startingTraining = ref(false)
// serverLesson이 비동기 페칭 후 세팅되므로 그 전까지 로딩 UI를 보여준다.
const lessonLoading = ref(true)
const submittingQuestion = ref(false)
const voiceSubmitting = ref(false)
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
  source: 'real',
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
const leaveConfirmed = ref(false)
const integrationError = ref('')
let resolveLeaveConfirmation: ((allow: boolean) => void) | null = null

watch(integrationError, (error) => {
  if (!error) return
  errorModal.show(error, '훈련 연결 오류')
  void router.replace({ name: challengeTrackId.value ? 'skill-challenge' : 'training-home' })
})

const gazeRequired = computed(() =>
  serverQuestions.value.some((question) => question.requiredInputs.includes('GAZE')),
)
const microphoneRequired = computed(() =>
  serverQuestions.value.some((question) => question.requiredInputs.includes('VOICE')),
)
const currentQuestionRequiresMicrophone = computed(() =>
  serverQuestions.value[session.progressState.currentQuestionIndex]?.requiredInputs.includes('VOICE') === true,
)

const currentQuestion = computed(() => session.currentQuestion.value)
const questionScroll = ref<HTMLElement | null>(null)
const sharedNextEnabled = computed(() =>
  session.progressState.isCurrentCorrect === true,
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
  'sound-manipulation': '단어를 소리에 맞게 바꿔봐!',
  'sound-omit': '잘 듣고 글자를 잘라봐!',
  'sound-blend': '소리를 합쳐봐!',
  'word-reading-grid': '낱말을 읽어봐!',
  'sentence-choice': '맞는 문장을 찾아봐!',
  'fill-blank': '빈칸을 채워봐!',
  'sentence-order': '문장을 만들어봐!',
}
const displayQuestion = computed(() => {
  const question = currentQuestion.value
  if (!question || !lesson.value) return question
  return {
    ...question,
    audioPromptEnabled: question.audioPromptEnabled ?? false,
    requiredInputs:
      serverQuestions.value[session.progressState.currentQuestionIndex]?.requiredInputs,
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
const gazeDeviceFallbackEnabled = cursorGazeFallbackEnabled

const gazeTransferSource = () => {
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
  if (isDeveloperMode.value) {
    pushDevGaze({ text, clientX, clientY, questionNumber: lastGazeWordHit.questionNumber, tokenIndex })
  }
  if (!attachWordHitToRecentSample(lastGazeWordHit)) {
    appendCursorGazeSampleFromHit(lastGazeWordHit)
  }
}

onMounted(async () => {
  window.addEventListener('iread:gaze', onGazeSample)
  window.addEventListener('iread:gaze-word-hit', onGazeWordHit)
  // 세션 초기화 및 첫 문제 준비(이전 정답/녹음은 모두 리셋)
  {
    const itemId = learningItemId.value
    if (!/^\d+$/.test(itemId)) {
      integrationError.value = '서버 학습 ID가 없어 학습을 시작할 수 없습니다.'
      lessonLoading.value = false
    } else {
      try {
        const studentId = getCachedStudent().studentId
        let intro = await learningRepository.value.getIntro(studentId, itemId)
        if (intro.status === 'COMPLETED') {
          await router.replace({ name: challengeTrackId.value ? 'skill-challenge' : 'training-home' })
          return
        }
        // 실력 검증은 문항당 발음 시도가 1회뿐이라, 중단된 검사(IN_PROGRESS)에 재진입하면
        // 남아 있는 시도 기록 때문에 모든 녹음이 409로 거부되고 평가 없이 통과 처리된다.
        // 검사는 언제든 예기치 않게 끊길 수 있으므로 재진입 시 세션을 초기화해 처음부터 다시 본다.
        if (challengeTrackId.value && intro.status === 'IN_PROGRESS') {
          await learningRepository.value.reset(studentId, itemId)
          intro = { ...intro, status: 'NOT_STARTED' }
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
        const templateMapping = getTrainingTemplateMapping(Number(intro.trainingTemplateId))
        const resolvedLessonId = templateMapping?.lessonId ?? lessonId.value
        const loadedLesson: TrainingLesson = {
          id: resolvedLessonId,
          categoryId: templateMapping?.categoryId ?? 'phonics',
          title: intro.trainingName,
          description: '오늘의 맞춤 훈련을 시작해요.',
          activityType,
          estimatedMinutes: 5,
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
      } finally {
        lessonLoading.value = false
      }
    }
  }
  if (!integrationError.value) {
    await startPlaying()
  }
})

const startPlaying = async () => {
  if (integrationError.value || startingTraining.value) return
  if (!gazeDeviceFallbackEnabled && gazeRequired.value && !eyeTrackerConnected.value) {
    deviceBlocker.value = 'eye-tracker'
    return
  }
  if (microphoneRequired.value && !microphoneAvailable.value) {
    deviceBlocker.value = 'microphone'
    return
  }
  startingTraining.value = true
  try {
    {
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
            !virtualEyeTrackerConnected.value && eyeTrackerConnected.value
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
  } catch (error) {
    integrationError.value =
      error instanceof Error ? error.message : '서버 훈련을 시작하지 못했습니다.'
  } finally {
    startingTraining.value = false
  }
}

onBeforeRouteLeave(() => {
  if (leaveConfirmed.value) return true
  if (phase.value === 'intro' || session.progressState.isCompleted) return true

  leaveConfirmationOpen.value = true
  return new Promise<boolean>((resolve) => {
    resolveLeaveConfirmation?.(false)
    resolveLeaveConfirmation = resolve
  })
})

const finishLeaveConfirmation = (allow: boolean) => {
  leaveConfirmationOpen.value = false
  if (allow) leaveConfirmed.value = true
  resolveLeaveConfirmation?.(allow)
  resolveLeaveConfirmation = null
}

onBeforeUnmount(() => {
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
    const gazeBlockerResolved = deviceBlocker.value === 'eye-tracker'
      && (gazeDeviceFallbackEnabled || eyeConnected)
    const microphoneBlockerResolved = deviceBlocker.value === 'microphone' && micAvailable
    if (gazeBlockerResolved || microphoneBlockerResolved) {
      deviceBlocker.value = null
      if (phase.value === 'intro') void startPlaying()
    }

    if (currentPhase !== 'playing' || completed) {
      deviceBlocker.value = null
      return
    }
    if (!gazeDeviceFallbackEnabled && gazeRequired.value && !eyeConnected) deviceBlocker.value = 'eye-tracker'
    else if (currentQuestionRequiresMicrophone.value && !micAvailable) deviceBlocker.value = 'microphone'
  },
)

const exitToHome = () => {
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
    if (phase.value === 'intro') await startPlaying()
  } finally {
    microphoneRetrying.value = false
  }
}

const goNext = async (response?: LearnerTraceSubmissionResponse) => {
  if (submittingQuestion.value) return
  {
    const mapped = serverQuestions.value[session.progressState.currentQuestionIndex]
    if (
      mapped?.requiredInputs.includes('VOICE')
      && !recordedQuestionNumbers.has(mapped.questionNumber)
    ) {
      // 액티비티에서 이미 읽은 음성이 있으면 최종 녹음으로 제출한다.
      // 없으면(선택형 문항 등) 별도 음성 게이트 없이 그대로 진행한다.
      const captured = session.storedRecordings[mapped.question.id]?.blob ?? null
      if (captured) {
        const submitted = await submitRecordedVoice(mapped, captured)
        if (!submitted) return
      }
    }
  }
  submittingQuestion.value = true
  try {
    {
      const itemId = learningItemId.value
      const mapped = serverQuestions.value[session.progressState.currentQuestionIndex]
      if (!mapped || !/^\d+$/.test(itemId)) {
        throw new Error('제출할 서버 훈련 문항을 확인할 수 없습니다.')
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
  word?: {
    expectedText: string
    targetIndex: number
    tokenIndex?: number
    completesQuestion: boolean
  },
) => {
  const mapped = serverQuestions.value[session.progressState.currentQuestionIndex]
  const itemId = learningItemId.value

  // 단어별 평가(word-reading): 시선으로 선택한 단어 하나만 Azure 평가한다.
  if (word) {
    if (!mapped || !/^\d+$/.test(itemId)) {
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
          targetIndex: word.targetIndex,
          tokenIndex: word.tokenIndex,
          expectedText: word.expectedText,
          audioFile: new File([blob], `training-${mapped.questionNumber}-${word.targetIndex}.${extension}`, {
            type: blob.type || 'audio/webm',
          }),
        },
      )
      recordVoiceScore({
        score: Math.round(result.pronunciationAccuracyScore),
        threshold: Math.round(result.pronunciationThreshold),
        passed: result.passed,
        canRetry: result.canRetry,
        expectedText: word.expectedText,
        questionNumber: mapped.questionNumber,
      })
      if (result.canRetry) {
        controls.retry(`${Math.round(result.pronunciationAccuracyScore)}점이에요. 다시 읽어봐요!`)
        return
      }
      if (word.completesQuestion) recordedQuestionNumbers.add(mapped.questionNumber)
      controls.success(
        result.passed
          ? `${Math.round(result.pronunciationAccuracyScore)}점! 잘 읽었어요!`
          : '끝까지 읽었어요!',
      )
    } catch (error) {
      if (isPronunciationAttemptLimitError(error)) {
        if (word.completesQuestion) recordedQuestionNumbers.add(mapped.questionNumber)
        controls.success('횟수를 다 썼어요. 다음으로 넘어가요.')
        return
      }
      controls.retry(
        error instanceof Error ? error.message : '목소리를 확인하지 못했어요. 다시 말해 주세요.',
      )
    } finally {
      voiceSubmitting.value = false
    }
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

// 액티비티에서 담아 둔 녹음을 문항의 최종 녹음으로 올린다. true를 반환하면 다음으로 진행한다.
const submitRecordedVoice = async (
  mapped: MappedTrainingQuestion,
  blob: Blob,
): Promise<boolean> => {
  const itemId = learningItemId.value
  if (!mapped.expectedText || !/^\d+$/.test(itemId)) {
    errorModal.show(new Error('녹음 정보를 확인할 수 없습니다.'), '녹음 제출 오류')
    return false
  }
  voiceSubmitting.value = true
  try {
    const extension = blob.type.includes('mp4') ? 'm4a' : 'webm'
    // 기준 점수 미달이어도 같은 녹음을 시도 한도까지 제출해 문항을 완료 상태로 만든다.
    for (let attempt = 0; attempt < 4; attempt += 1) {
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
      if (!result.canRetry) {
        recordedQuestionNumbers.add(mapped.questionNumber)
        return true
      }
    }
    errorModal.show(new Error('녹음 제출을 완료하지 못했습니다.'), '녹음 제출 오류')
    return false
  } catch (error) {
    if (isPronunciationAttemptLimitError(error)) {
      recordedQuestionNumbers.add(mapped.questionNumber)
      return true
    }
    errorModal.show(
      error instanceof Error ? error : new Error('녹음을 저장하지 못했습니다.'),
      '녹음 제출 오류',
    )
    return false
  } finally {
    voiceSubmitting.value = false
  }
}

watch(() => session.progressState.currentQuestionIndex, () => {
  voiceRecorder.reset()
  clearVoiceScore()
})

const saveAndFinish = async () => {
  deviceBlocker.value = null
  voiceRecorder.reset()
  phase.value = 'saving'
  let ok = false
  let nextCurriculumItem: (typeof dailyCurriculum.curriculumItems)[number] | null = null
  {
    session.savingState.status = 'saving'
    session.savingState.errorMessage = null
    try {
      const itemId = learningItemId.value
      if (!/^\d+$/.test(itemId)) throw new Error('서버 학습 ID가 올바르지 않습니다.')
      if (gazeSessionId.value && !gazeSessionCompleted.value) {
        const gazeData = createGazeSubmission(serverQuestions.value, gazeSamples)
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
  }
  if (ok) {
    session.completeLesson()
    if (challengeTrackId.value) {
      try {
        const plan = await learnerTestRepository.getChallengePlan(getCachedStudent().studentId)
        if (plan.completed) {
          learnerSession.markChallengeCompleted()
          await router.replace({ name: 'skill-challenge-complete' })
          return
        }
        if (plan.nextTestId && plan.nextTestId !== learningItemId.value) {
          await router.replace({
            name: 'skill-challenge-lesson',
            params: {
              trackId: plan.nextTrackCode ?? challengeTrackId.value,
              testId: plan.nextTestId,
            },
          })
          return
        }
      } catch {
        // 다음 계획 조회 실패 또는 서버가 아직 완료를 반영 전 → 축하 화면으로 폴백
      }
      await router.replace({
        name: 'skill-challenge-question-complete',
        params: { trackId: challengeTrackId.value, testId: learningItemId.value },
        query: { lessonId: lessonId.value },
      })
      return
    }
    void router.replace(
      nextCurriculumItem
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
  <div
    class="lesson-view"
    :data-companion-state="session.progressState.isCurrentCorrect === true
      ? 'correct'
      : session.progressState.isCurrentCorrect === false
        ? 'retry'
        : undefined"
  >
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

    <!-- 로딩: API 모드 비동기 페칭 중 -->
    <div v-if="lessonLoading" class="lesson-loading" role="status" aria-live="polite">
      <p>학습을 준비하고 있어요…</p>
    </div>
    <!-- 폴백: 알 수 없는 레슨 -->
    <div v-else-if="!lesson" class="fallback">
      <p>레슨을 불러올 수 없어요.</p>
      <button class="retry-button" type="button" @click="exitToHome">훈련 선택으로 가기</button>
    </div>
  </div>
</template>

<style scoped src="@/styles/training/TrainingLessonView.css"></style>
