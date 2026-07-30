<script setup lang="ts">
// 훈련 레슨 화면: 인트로 → 문제 풀이 → 결과 저장
// 세션 상태는 useTrainingSession(싱글톤)에서 공유합니다.
// 액티비티는 'next' 이벤트만 보내며, 다음 레슨으로의 이동/자동 진행은 이곳에서 처리합니다.
// (향후 자동 커리큘럼 연결 시 이 지점의 goNext/finish 흐름을 서버 세션 기반으로 교체)
//
// 본 화면은 "메인 섬 화면"처럼 요소를 최소로 유지합니다.
// 별도의 피드백 배너/무거운 헤더 대신 토끼 한 마리가 역할을 모두 맡습니다.

import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import type { TrainingActivityType, TrainingLesson } from '@/types/training'
import { getLessonById } from '@/mocks/trainingLessons'
import { useDailyCurriculum } from '@/composables/useDailyCurriculum'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { useDeviceStatus } from '@/composables/useDeviceStatus'
import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import {
  getSkillChallengeLessons,
  isSkillChallengeTrackId,
  useSkillChallenge,
} from '@/composables/useSkillChallenge'
import TrainingIntro from '@/components/training/TrainingIntro.vue'
import { trainingActivityComponents } from '@/components/training/activityRegistry'
import PageBackButton from '@/components/common/PageBackButton.vue'
import leaveTrainingRabbit from '@/assets/training/ui/leave-training-rabbit.png'
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

const route = useRoute()
const router = useRouter()
const session = useTrainingSession()
const dailyCurriculum = useDailyCurriculum()
const skillChallenge = useSkillChallenge()
const errorModal = useLearnerErrorModalStore()
const { eyeTrackerConnected, microphoneAvailable } = useDeviceStatus()
const voiceRecorder = useVoiceRecorder()

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
  learnerDataSource === 'api' ? serverLesson.value : fallbackLesson.value,
)
const serverIntro = ref<LearnerTrainingIntro | null>(null)
const serverQuestions = ref<readonly MappedTrainingQuestion[]>([])
const startingTraining = ref(false)
const submittingQuestion = ref(false)
const voiceGateOpen = ref(false)
const voiceSubmitting = ref(false)
const voiceFeedback = ref('')
const pendingNextResponse = ref<LearnerTraceSubmissionResponse | undefined>()
const recordedQuestionNumbers = new Set<number>()
const gazeSessionId = ref<string | null>(null)
const gazeSessionCompleted = ref(false)
const gazeSamples: DeviceGazeSample[] = []
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
const leaveConfirmationOpen = ref(false)
const integrationError = ref('')
let resolveLeaveConfirmation: ((allow: boolean) => void) | null = null

watch(integrationError, (error) => {
  if (!error) return
  errorModal.show(new Error(error), '훈련 연결 오류')
  void router.replace({ name: challengeTrackId.value ? 'skill-challenge' : 'training-home' })
})

const gazeRequiredActivities = new Set<TrainingActivityType>([
  'gaze-trace',
  'word-reading-grid',
  'sentence-reading',
])
const microphoneRequiredActivities = new Set<TrainingActivityType>([
  'gaze-trace',
  'word-reading-grid',
  'sentence-reading',
  'read-aloud',
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

const currentQuestion = computed(() => session.currentQuestion.value)
const conciseInstructions: Partial<Record<TrainingActivityType, string>> = {
  'gaze-trace': '글자를 따라가봐요',
  'audio-letter-choice': '첫소리를 찾아봐요',
  'listen-and-select': '같은 소리를 찾아봐요',
  'sound-choice': '소리를 찾아봐요',
  'letter-build': '글자를 만들어봐요',
  'sound-manipulation': '낱말을 바꿔봐요',
  'sound-omit': '소리를 빼봐요',
  'sound-blend': '소리를 합쳐봐요',
  'card-combine': '글자를 합쳐봐요',
  'word-reading-grid': '낱말을 읽어봐요',
  'sentence-reading': '문장을 읽어봐요',
  'sentence-choice': '맞는 문장을 찾아봐요',
  'fill-blank': '빈칸을 채워봐요',
  'sentence-order': '문장을 만들어봐요',
  'read-aloud': '소리 내어 읽어봐요',
}
const displayQuestion = computed(() => {
  const question = currentQuestion.value
  if (!question || !lesson.value) return question
  return {
    ...question,
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
const gazeDeviceFallbackEnabled = mockGazeSubmissionsEnabled

const updateGazeTransferDebug = (patch: Partial<typeof gazeTransferDebug.value>) => {
  gazeTransferDebug.value = {
    ...gazeTransferDebug.value,
    ...patch,
    sampleCount: gazeSamples.length,
    source: mockGazeSubmissionsEnabled ? 'mock' : 'real',
  }
  window.localStorage.setItem(
    'iread-gaze-transfer-debug',
    JSON.stringify(gazeTransferDebug.value),
  )
}

const onGazeSample = (event: Event) => {
  if (phase.value !== 'playing' || !gazeSessionId.value) return
  const detail = (event as CustomEvent<Record<string, unknown>>).detail
  const x = Number(detail?.x ?? detail?.clientX)
  const y = Number(detail?.y ?? detail?.clientY)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  gazeSamples.push({
    x,
    y,
    capturedAtMs: Date.now(),
    questionNumber: session.currentQuestionNumber.value,
  })
  updateGazeTransferDebug({ lastSampleAt: new Date().toLocaleTimeString() })
}

onMounted(async () => {
  window.addEventListener('iread:gaze', onGazeSample)
  if (challengeTrackId.value) {
    skillChallenge.ensureChallenge(challengeTrackId.value, lessonId.value)
  }
  // 세션 초기화 및 첫 문제 준비(이전 정답/녹음은 모두 리셋)
  if (learnerDataSource === 'mock' && lesson.value) {
    session.startLesson(lesson.value)
  }
  if (learnerDataSource === 'api') {
    const itemId = learningItemId.value
    if (!/^\d+$/.test(itemId)) {
      integrationError.value = '서버 학습 ID가 없어 학습을 시작할 수 없습니다.'
    } else {
      try {
        const studentId = getCachedStudent().studentId
        const intro = await learningRepository.value.getIntro(studentId, itemId)
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
  phase.value = 'intro'
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
    if (learnerDataSource === 'api') {
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
            mockGazeSubmissionsEnabled
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
  } catch (error) {
    integrationError.value =
      error instanceof Error ? error.message : '서버 훈련을 시작하지 못했습니다.'
  } finally {
    startingTraining.value = false
  }
}

onBeforeRouteLeave(() => {
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
  window.removeEventListener('iread:gaze', onGazeSample)
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
  [eyeTrackerConnected, microphoneAvailable],
  ([eyeConnected, micAvailable]) => {
    if (deviceBlocker.value === 'eye-tracker' && gazeDeviceFallbackEnabled) deviceBlocker.value = null
    if (deviceBlocker.value === 'microphone' && voiceDeviceFallbackEnabled) deviceBlocker.value = null
    if (deviceBlocker.value === 'eye-tracker' && eyeConnected) deviceBlocker.value = null
    if (deviceBlocker.value === 'microphone' && micAvailable) deviceBlocker.value = null

    if (phase.value !== 'playing') return
    if (!gazeDeviceFallbackEnabled && gazeRequired.value && !eyeConnected) deviceBlocker.value = 'eye-tracker'
    else if (!voiceDeviceFallbackEnabled && microphoneRequired.value && !micAvailable) deviceBlocker.value = 'microphone'
  },
)

const exitToHome = () => {
  void router.push({ name: challengeTrackId.value ? 'skill-challenge' : 'training-home' })
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
const goNext = async (response?: LearnerTraceSubmissionResponse) => {
  if (submittingQuestion.value) return
  if (learnerDataSource === 'api') {
    const mapped = serverQuestions.value[session.progressState.currentQuestionIndex]
    if (
      mapped?.requiredInputs.includes('VOICE')
      && !recordedQuestionNumbers.has(mapped.questionNumber)
      && !mockVoiceSubmissionsEnabled
    ) {
      pendingNextResponse.value = response
      voiceFeedback.value = ''
      voiceRecorder.reset()
      voiceGateOpen.value = true
      return
    }
  }
  submittingQuestion.value = true
  try {
    if (learnerDataSource === 'api') {
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

const toggleVoiceRecording = () => {
  if (voiceRecorder.state.status === 'recording') voiceRecorder.stop()
  else void voiceRecorder.start()
}

const submitVoiceRecording = async () => {
  const mapped = serverQuestions.value[session.progressState.currentQuestionIndex]
  const blob = voiceRecorder.audioBlob.value
  const itemId = learningItemId.value
  if (!mapped || !blob || !mapped.expectedText || !/^\d+$/.test(itemId)) {
    voiceFeedback.value = '녹음 정보를 확인할 수 없습니다.'
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
      return
    }
    recordedQuestionNumbers.add(mapped.questionNumber)
    voiceGateOpen.value = false
    const pending = pendingNextResponse.value
    pendingNextResponse.value = undefined
    await goNext(pending)
  } catch (error) {
    voiceFeedback.value = error instanceof Error ? error.message : '녹음을 저장하지 못했습니다.'
  } finally {
    voiceSubmitting.value = false
  }
}

// 결과 저장 중에는 기술 용어 없이 마무리 로딩만 보여줍니다.
const saveAndFinish = async () => {
  phase.value = 'saving'
  let ok = false
  let nextCurriculumItem: (typeof dailyCurriculum.curriculumItems)[number] | null = null
  if (learnerDataSource === 'api') {
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
    <div v-if="!integrationError && phase === 'intro' && lesson" class="lesson-topbar lesson-topbar--intro">
      <PageBackButton label="훈련 선택으로 돌아가기" @back="exitToHome" />
    </div>

    <!-- 인트로 -->
    <TrainingIntro
      v-if="!integrationError && phase === 'intro' && lesson"
      :lesson="lesson"
      @start="startPlaying"
    />

    <!-- 문제 풀이 -->
    <div v-else-if="phase === 'playing' && lesson" class="playing">
      <div class="lesson-topbar lesson-topbar--inside">
        <PageBackButton label="학습을 그만하고 훈련 선택으로 돌아가기" @back="exitToHome" />
        <div
          class="topbar-progress"
          role="status"
          :aria-label="`현재 ${session.currentQuestionNumber.value}번, 전체 ${session.totalQuestions.value}문제`"
        >
          <strong>{{ session.currentQuestionNumber.value }} / {{ session.totalQuestions.value }}</strong>
          <span class="topbar-progress-dots" aria-hidden="true">
            <span
              v-for="i in session.totalQuestions.value"
              :key="i"
              class="prog-dot"
              :class="{ active: i <= session.currentQuestionNumber.value }"
            ></span>
          </span>
        </div>
        <span class="lesson-topbar-spacer" aria-hidden="true"></span>
      </div>
      <h1 v-if="displayQuestion" class="learner-instruction lesson-instruction">
        {{ displayQuestion.instruction }}
      </h1>
      <p v-if="displayedHint" class="learner-instruction" role="status">
        {{ displayedHint }}
      </p>
      <div class="question-scroll">
        <component
          :is="activityComponent"
          v-if="displayQuestion && activityComponent"
          :key="displayQuestion.id"
          :question="displayQuestion"
          @next="goNext"
        />
      </div>
    </div>

    <!-- 저장 오버레이(저장 중 입력 잠금) -->
    <Transition name="fade">
      <div v-if="phase === 'saving'" class="saving-overlay" role="status" aria-live="polite">
        <div class="saving-panel">
          <template v-if="!isSavingFailed">
            <span class="saving-spinner" aria-hidden="true"></span>
            <p class="saving-text">학습을 마무리하고 있어요…</p>
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
        v-if="voiceGateOpen"
        class="device-blocker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-gate-title"
      >
        <section class="device-blocker-panel">
          <span class="device-blocker-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48">
              <rect x="17" y="6" width="14" height="25" rx="7" />
              <path d="M11 23c0 8 5.8 14 13 14s13-6 13-14M24 37v7M17 44h14" />
            </svg>
          </span>
          <h2 id="voice-gate-title">{{ serverQuestions[session.progressState.currentQuestionIndex]?.expectedText }}</h2>
          <p>{{ voiceFeedback || '완성한 글자나 문장을 소리 내어 읽어 주세요.' }}</p>
          <button
            v-if="voiceRecorder.state.status !== 'recorded'"
            type="button"
            :disabled="voiceRecorder.state.status === 'requesting'"
            @click="toggleVoiceRecording"
          >
            {{ voiceRecorder.state.status === 'recording' ? '녹음 끝내기' : '녹음 시작하기' }}
          </button>
          <button
            v-else
            type="button"
            :disabled="voiceSubmitting"
            @click="submitVoiceRecording"
          >
            {{ voiceSubmitting ? '점수를 확인하고 있어요…' : '발음 점수 확인하기' }}
          </button>
        </section>
      </div>
    </Transition>

    <Transition name="fade">
      <div
        v-if="deviceBlocker"
        class="device-blocker"
        role="alertdialog"
        aria-modal="true"
        :aria-labelledby="`${deviceBlocker}-title`"
      >
        <section class="device-blocker-panel">
          <span class="device-blocker-icon" aria-hidden="true">
            <svg v-if="deviceBlocker === 'eye-tracker'" viewBox="0 0 64 48">
              <ellipse cx="20" cy="24" rx="15" ry="20" />
              <ellipse cx="44" cy="24" rx="15" ry="20" />
              <circle cx="22" cy="26" r="8" />
              <circle cx="46" cy="26" r="8" />
              <circle class="device-icon-shine" cx="25" cy="22" r="3" />
              <circle class="device-icon-shine" cx="49" cy="22" r="3" />
            </svg>
            <svg v-else viewBox="0 0 48 48">
              <rect x="17" y="6" width="14" height="25" rx="7" />
              <path d="M11 23c0 8 5.8 14 13 14s13-6 13-14M24 37v7M17 44h14" />
            </svg>
          </span>
          <h2 :id="`${deviceBlocker}-title`">
            {{ deviceBlocker === 'eye-tracker' ? '아이트래커를 연결해 주세요' : '마이크를 켜 주세요' }}
          </h2>
          <p>
            {{ deviceBlocker === 'eye-tracker'
              ? '이 훈련은 눈으로 따라가는 활동이에요.'
              : '이 훈련은 목소리를 들려주는 활동이에요.' }}
          </p>
          <button type="button" @click="exitToHome">훈련 선택으로 돌아가기</button>
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
          <h2 id="leave-confirmation-title">학습을 그만할까요?</h2>
          <p>나가면 이 훈련은 다음에 처음부터 다시 시작해요.</p>
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
