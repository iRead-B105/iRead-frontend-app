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
import type { TrainingActivityType } from '@/types/training'
import { getLessonById } from '@/mocks/trainingLessons'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { useDeviceStatus } from '@/composables/useDeviceStatus'
import {
  isSkillChallengeTrackId,
  useSkillChallenge,
} from '@/composables/useSkillChallenge'
import TrainingIntro from '@/components/training/TrainingIntro.vue'
import ListenAndSelectActivity from '@/components/training/activities/ListenAndSelectActivity.vue'
import AudioLetterChoiceActivity from '@/components/training/activities/AudioLetterChoiceActivity.vue'
import GazeTraceActivity from '@/components/training/activities/GazeTraceActivity.vue'
import LetterBuildActivity from '@/components/training/activities/LetterBuildActivity.vue'
import SoundManipulationActivity from '@/components/training/activities/SoundManipulationActivity.vue'
import HangulBattleActivity from '@/components/training/activities/HangulBattleActivity.vue'
import WordReadingGridActivity from '@/components/training/activities/WordReadingGridActivity.vue'
import SentenceReadingActivity from '@/components/training/activities/SentenceReadingActivity.vue'
import SoundBuildActivity from '@/components/training/activities/SoundBuildActivity.vue'
import SoundOmitActivity from '@/components/training/activities/SoundOmitActivity.vue'
import SoundChoiceActivity from '@/components/training/activities/SoundChoiceActivity.vue'
import FillBlankActivity from '@/components/training/activities/FillBlankActivity.vue'
import SentenceOrderActivity from '@/components/training/activities/SentenceOrderActivity.vue'
import CardCombineActivity from '@/components/training/activities/CardCombineActivity.vue'
import SentenceChoiceActivity from '@/components/training/activities/SentenceChoiceActivity.vue'
import ReadAloudActivity from '@/components/training/activities/ReadAloudActivity.vue'
import PageBackButton from '@/components/common/PageBackButton.vue'
import RiveGuideCharacter from '@/components/RiveGuideCharacter.vue'
import leaveTrainingRabbit from '@/assets/training/ui/leave-training-rabbit.png'
import lessonProgressTitleBoard from '@/assets/training/ui/lesson-progress-title-board-compact.webp'
import eyeTrackerIcon from '@/assets/icons/eye-tracker.svg'
import microphoneIcon from '@/assets/icons/microphone.svg'
import { learnerDataSource } from '@/config/learnerDataSource'
import { learnerTrainingRepository } from '@/features/learner/training'
import { getCachedStudent } from '@/services/learnerDataRepository'
import { useLearnerErrorModalStore } from '@/stores/learnerErrorModal'

const route = useRoute()
const router = useRouter()
const session = useTrainingSession()
const skillChallenge = useSkillChallenge()
const errorModal = useLearnerErrorModalStore()
const { eyeTrackerConnected, microphoneAvailable } = useDeviceStatus()

const categoryId = computed(() => String(route.params.categoryId ?? ''))
const lessonId = computed(() => String(route.params.lessonId ?? ''))
const debugMode = computed(() => import.meta.env.DEV && route.query.debug === '1')
const challengeTrackId = computed(() => {
  const value = String(route.query.challenge ?? '')
  return isSkillChallengeTrackId(value) ? value : null
})

const lesson = computed(() => getLessonById(lessonId.value))
// 구현된 액티비티 컴포넌트만 매핑. 준비 중 유형은 여기 없으며(도달 불가),
// 향후 추가 시 이 맵에만 등록하면 됩니다.
const activityComponents: Partial<Record<TrainingActivityType, Component>> = {
  'gaze-trace': GazeTraceActivity,
  'audio-letter-choice': AudioLetterChoiceActivity,
  'letter-build': LetterBuildActivity,
  'sound-manipulation': SoundManipulationActivity,
  'hangul-battle': HangulBattleActivity,
  'word-reading-grid': WordReadingGridActivity,
  'sentence-reading': SentenceReadingActivity,
  'listen-and-select': ListenAndSelectActivity,
  'sound-choice': SoundChoiceActivity,
  'sound-omit': SoundOmitActivity,
  'sound-blend': SoundBuildActivity,
  'card-combine': CardCombineActivity,
  'sentence-choice': SentenceChoiceActivity,
  'read-aloud': ReadAloudActivity,
  'fill-blank': FillBlankActivity,
  'sentence-order': SentenceOrderActivity,
}

const activityComponent = computed<Component | null>(() =>
  lesson.value ? (activityComponents[lesson.value.activityType] ?? null) : null,
)

type Phase = 'intro' | 'playing' | 'saving'
const phase = ref<Phase>('intro')
const activityGuideMessage = ref('')
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
  lesson.value ? gazeRequiredActivities.has(lesson.value.activityType) : false,
)
const microphoneRequired = computed(() =>
  lesson.value ? microphoneRequiredActivities.has(lesson.value.activityType) : false,
)

const currentQuestion = computed(() => session.currentQuestion.value)
const conciseInstructions: Partial<Record<TrainingActivityType, string>> = {
  'gaze-trace': '글자를 따라가 봐!',
  'audio-letter-choice': '첫소리를 찾아봐!',
  'listen-and-select': '같은 소리를 찾아봐!',
  'sound-choice': '소리를 찾아봐!',
  'letter-build': '글자를 만들어봐!',
  'sound-manipulation': '낱말을 바꿔봐!',
  'sound-omit': '소리를 빼봐!',
  'sound-blend': '소리를 합쳐봐!',
  'card-combine': '글자를 합쳐봐!',
  'word-reading-grid': '낱말을 읽어봐!',
  'sentence-reading': '문장을 읽어봐!',
  'sentence-choice': '맞는 문장을 찾아봐!',
  'fill-blank': '빈칸을 채워봐!',
  'sentence-order': '문장을 만들어봐!',
  'read-aloud': '소리 내어 읽어봐!',
}
const displayQuestion = computed(() => {
  const question = currentQuestion.value
  if (!question || !lesson.value) return question
  return {
    ...question,
    instruction: conciseInstructions[lesson.value.activityType] ?? '해봐!',
    subInstruction: undefined,
  }
})
const deviceFallbackEnabled = import.meta.env.DEV

onMounted(async () => {
  if (challengeTrackId.value) {
    skillChallenge.ensureChallenge(challengeTrackId.value, lessonId.value)
  }
  // 세션 초기화 및 첫 문제 준비(이전 정답/녹음은 모두 리셋)
  if (lesson.value) {
    session.startLesson(lesson.value)
  }
  if (learnerDataSource === 'api' && !debugMode.value) {
    const trainingId = String(route.query.trainingId ?? '')
    if (!/^\d+$/.test(trainingId)) {
      integrationError.value = '서버 훈련 ID가 없어 학습을 시작할 수 없습니다.'
    } else {
      try {
        await learnerTrainingRepository.getIntro(getCachedStudent().studentId, trainingId)
        integrationError.value =
          '서버 훈련은 확인했지만 generatedData/question을 화면 활동으로 바꾸는 계약이 필요합니다.'
      } catch (error) {
        integrationError.value =
          error instanceof Error ? error.message : '서버 훈련 정보를 불러오지 못했습니다.'
      }
    }
  }
  phase.value = debugMode.value ? 'playing' : 'intro'
})

const startPlaying = () => {
  if (integrationError.value) return
  if (!deviceFallbackEnabled && gazeRequired.value && !eyeTrackerConnected.value) {
    deviceBlocker.value = 'eye-tracker'
    return
  }
  if (!deviceFallbackEnabled && microphoneRequired.value && !microphoneAvailable.value) {
    deviceBlocker.value = 'microphone'
    return
  }
  phase.value = 'playing'
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
  resolveLeaveConfirmation?.(false)
  resolveLeaveConfirmation = null
})

watch(
  [eyeTrackerConnected, microphoneAvailable],
  ([eyeConnected, micAvailable]) => {
    if (debugMode.value) return
    if (deviceBlocker.value === 'eye-tracker' && eyeConnected) deviceBlocker.value = null
    if (deviceBlocker.value === 'microphone' && micAvailable) deviceBlocker.value = null

    if (phase.value !== 'playing') return
    if (gazeRequired.value && !eyeConnected) deviceBlocker.value = 'eye-tracker'
    else if (microphoneRequired.value && !micAvailable) deviceBlocker.value = 'microphone'
  },
)

const exitToHome = () => {
  if (debugMode.value) {
    void router.push({ name: 'training-home', query: { debugPanel: '1' } })
    return
  }
  void router.push({ name: challengeTrackId.value ? 'skill-challenge' : 'training-home' })
}

// 다음 문제로 이동. 마지막 문제면 결과 저장 흐름으로 진입.
const goNext = () => {
  const hasMore = session.nextQuestion()
  if (!hasMore) {
    void saveAndFinish()
  }
}

// 결과 저장 중에는 기술 용어 없이 마무리 로딩만 보여줍니다.
const saveAndFinish = async () => {
  phase.value = 'saving'
  const ok = await session.saveResult()
  if (ok) {
    session.completeLesson()
    if (debugMode.value) {
      void router.replace({ name: 'training-home', query: { debugPanel: '1' } })
      return
    }
    // 완료 화면으로 자동 이동
    void router.replace({
      name: 'training-complete',
      params: { categoryId: categoryId.value, lessonId: lessonId.value },
      query: challengeTrackId.value ? { challenge: challengeTrackId.value } : undefined,
    })
  }
  // 실패 시 phase 는 'saving' 유지 → 저장 오버레이에서 재시도 버튼 노출
}

const isSavingFailed = computed(() => session.savingState.status === 'failed')
const guideMessage = computed(() => {
  if (session.progressState.isCurrentCorrect === true) return '잘했어!\n정말 대단해!'
  if (session.progressState.isCurrentCorrect === false) {
    return session.progressState.attemptCount >= 2
      ? '천천히 다시 해봐!\n할 수 있어!'
      : '괜찮아!\n한 번 더 해봐!'
  }
  if (activityGuideMessage.value) return activityGuideMessage.value
  if (session.progressState.hintLevel > 0) return '힌트를 보고\n천천히 해봐!'
  if (lesson.value?.activityType === 'gaze-trace') return '반짝이는 점을 눈으로 따라가 봐!'
  return '할 수 있어!\n같이 해보자!'
})
const guideMood = computed(() =>
  session.progressState.isCurrentCorrect === true ? 'cheer' as const : 'idle' as const,
)

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
    <div
      v-else-if="phase === 'playing' && lesson"
      class="playing"
      :class="{ 'playing--first-sound': lesson.id === 'word-first-sound-choice' }"
    >
      <div class="lesson-topbar lesson-topbar--inside">
        <PageBackButton label="학습을 그만하고 훈련 선택으로 돌아가기" @back="exitToHome" />
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
              <h1
                v-if="lesson.activityType !== 'gaze-trace'"
                class="learner-instruction lesson-instruction"
              >
                {{ displayQuestion.instruction }}
              </h1>
            </div>
          </div>
        </section>
        <span class="lesson-topbar-spacer" aria-hidden="true"></span>
      </div>
      <div class="question-scroll">
        <component
          :is="activityComponent"
          v-if="displayQuestion && activityComponent"
          :key="displayQuestion.id"
          :question="displayQuestion"
          @next="goNext"
          @guide-message="activityGuideMessage = $event"
        />
      </div>
      <RiveGuideCharacter
        class="lesson-guide"
        :message="guideMessage"
        :mood="guideMood"
        :show-bubble="lesson.activityType !== 'gaze-trace'"
        :speak-message="lesson.activityType === 'gaze-trace'"
      />
    </div>

    <!-- 저장 오버레이(저장 중 입력 잠금) -->
    <Transition name="fade">
      <div v-if="phase === 'saving'" class="saving-overlay" role="status" aria-live="polite">
        <div class="saving-panel">
          <template v-if="!isSavingFailed">
            <span class="saving-spinner" aria-hidden="true"></span>
            <p class="saving-text">학습을 마무리하고 있어…</p>
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
        v-if="deviceBlocker"
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

    <!-- 폴백: 알 수 없는 레슨 -->
    <div v-if="!lesson" class="fallback">
      <p>레슨을 불러올 수 없어요.</p>
      <button class="retry-button" type="button" @click="exitToHome">훈련 선택으로 가기</button>
    </div>
  </div>
</template>

<style scoped src="@/styles/training/TrainingLessonView.css"></style>
