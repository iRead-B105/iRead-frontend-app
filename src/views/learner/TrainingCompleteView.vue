<script setup lang="ts">
// 훈련 완료 화면
// 세션에 기록된 목업 완료 타임스탬프와 축하 메시지를 보여줍니다.
// 점수/진단 결과는 표시하지 않습니다.

import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getLessonById } from '@/mocks/trainingLessons'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { useDailyCurriculum, type DailyCurriculumItem } from '@/composables/useDailyCurriculum'
import {
  getSkillChallengeLessons,
  isSkillChallengeTrackId,
  useSkillChallenge,
  type SkillChallengeLesson,
  type SkillChallengeTrackId,
} from '@/composables/useSkillChallenge'
import TrainingComplete from '@/components/training/TrainingComplete.vue'
import { learnerDataSource } from '@/config/learnerDataSource'
import { learnerTestRepository } from '@/features/learner/test'
import { getCachedStudent } from '@/services/learnerDataRepository'
import { useLearnerSessionStore } from '@/stores/learnerSession'
import { useLearnerErrorModalStore } from '@/stores/learnerErrorModal'

const route = useRoute()
const router = useRouter()
const session = useTrainingSession()
const dailyCurriculum = useDailyCurriculum()
const skillChallenge = useSkillChallenge()
const learnerSession = useLearnerSessionStore()
const errorModal = useLearnerErrorModalStore()
const nextCurriculumItem = ref<DailyCurriculumItem | null>(null)
const nextChallengeLesson = ref<SkillChallengeLesson | null>(null)
const nextChallengeTestId = ref<string | null>(null)
const nextChallengeTrackId = ref<SkillChallengeTrackId | null>(null)

const challengeTrackId = computed(() => {
  const value = String(route.params.trackId ?? route.query.challenge ?? '')
  return isSkillChallengeTrackId(value) ? value : null
})
const challengePresentation = computed(() =>
  challengeTrackId.value
    ? getSkillChallengeLessons(challengeTrackId.value).find(
      (item) => item.lessonId === String(route.query.lessonId ?? ''),
    ) ?? getSkillChallengeLessons(challengeTrackId.value)[0] ?? null
    : null,
)
const lessonId = computed(() => String(
  route.params.lessonId ?? challengePresentation.value?.lessonId ?? '',
))
const categoryId = computed(() => String(
  route.params.categoryId ?? challengePresentation.value?.categoryId ?? '',
))
const currentTestId = computed(() => String(
  route.params.testId ?? route.query.testId ?? '',
))

const lesson = computed(() => getLessonById(lessonId.value))

// 마지막 문제의 완료 피드백 문구(없으면 기본 문구)
const completionMessage = computed(() => {
  const questions = lesson.value?.questions
  if (questions && questions.length > 0) {
    const last = questions[questions.length - 1]
    return '훈련을 끝까지 해냈어!'
  }
  return '훈련을 끝까지 해냈어!'
})

// 직접 진입(완료되지 않은 상태) 시 인트로로 보냄
onMounted(async () => {
  const valid =
    session.progressState.isCompleted &&
    session.progressState.lessonId === lessonId.value &&
    session.progressState.categoryId === categoryId.value
  if (!valid) {
    void router.replace(
      challengeTrackId.value &&
      (currentTestId.value === 'mock' || /^\d+$/.test(currentTestId.value))
        ? {
          name: 'skill-challenge-lesson',
          params: {
            trackId: challengeTrackId.value,
            testId: currentTestId.value,
            lessonId: lessonId.value,
          },
        }
        : {
          name: 'training-lesson',
          params: { categoryId: categoryId.value, lessonId: lessonId.value },
        },
    )
    return
  }
  if (challengeTrackId.value) {
    if (learnerDataSource === 'api') {
      try {
        const plan = await learnerTestRepository.getChallengePlan(
          getCachedStudent().studentId,
        )
        nextChallengeTestId.value = plan.nextTestId
        nextChallengeTrackId.value = plan.nextTrackCode
        nextChallengeLesson.value = plan.nextTrackCode
          ? getSkillChallengeLessons(plan.nextTrackCode)[0] ?? null
          : null
        if (plan.completed) learnerSession.markChallengeCompleted()
      } catch (error) {
        errorModal.show(error, '실력 도전 진행 상태 조회 오류')
        await router.replace({ name: 'skill-challenge' })
        return
      }
    } else {
      skillChallenge.ensureChallenge(challengeTrackId.value, lessonId.value)
      nextChallengeLesson.value = skillChallenge.markLessonComplete(
        lessonId.value,
        challengeTrackId.value,
      )
      nextChallengeTestId.value = nextChallengeLesson.value ? 'mock' : null
      nextChallengeTrackId.value = nextChallengeLesson.value?.trackId ?? null
      if (!nextChallengeLesson.value) learnerSession.markChallengeCompleted()
    }
  } else {
    nextCurriculumItem.value = dailyCurriculum.markLessonComplete(lessonId.value)
  }
})

const handleRetry = () => {
  // 다시 하기 → 첫 문제로 바로 이동. startLesson 은 레슨 진입 시 재실행됨
  void router.push(
    challengeTrackId.value
      ? {
        name: 'skill-challenge-lesson',
        params: {
          trackId: challengeTrackId.value,
          testId: currentTestId.value,
          lessonId: lessonId.value,
        },
      }
      : {
        name: 'training-lesson',
        params: { categoryId: categoryId.value, lessonId: lessonId.value },
      },
  )
}

const handleContinue = () => {
  if (challengeTrackId.value) {
    if (!nextChallengeLesson.value || !nextChallengeTestId.value) {
      void router.push({
        name: 'skill-challenge-complete',
      })
      return
    }

    void router.push({
      name: 'skill-challenge-lesson',
      params: {
        trackId: nextChallengeTrackId.value ?? challengeTrackId.value,
        testId: nextChallengeTestId.value,
        ...(learnerDataSource === 'mock'
          ? { lessonId: nextChallengeLesson.value.lessonId }
          : {}),
      },
    })
    return
  }

  if (!nextCurriculumItem.value) {
    void router.push({ name: 'training-today-complete' })
    return
  }

  void router.push({
    name: 'training-lesson',
    params: {
      categoryId: nextCurriculumItem.value.categoryId,
      lessonId: nextCurriculumItem.value.lesson.id,
    },
    query: { trainingId: nextCurriculumItem.value.trainingId },
  })
}
</script>

<template>
  <TrainingComplete
    v-if="lesson"
    :lesson-title="lesson.title"
    :completed-at="session.progressState.completedAt"
    :completion-message="completionMessage"
    :perfect="session.isPerfectLesson.value"
    :primary-label="challengeTrackId
      ? (nextChallengeLesson ? '다음 검증 이어가기' : '실력 검증 완료')
      : (nextCurriculumItem ? '다음 훈련 시작' : '오늘 학습 완료')"
    @retry="handleRetry"
    @continue="handleContinue"
  />
</template>
