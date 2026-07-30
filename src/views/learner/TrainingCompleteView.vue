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
  isSkillChallengeTrackId,
  useSkillChallenge,
  type SkillChallengeLesson,
} from '@/composables/useSkillChallenge'
import TrainingComplete from '@/components/training/TrainingComplete.vue'

const route = useRoute()
const router = useRouter()
const session = useTrainingSession()
const dailyCurriculum = useDailyCurriculum()
const skillChallenge = useSkillChallenge()
const nextCurriculumItem = ref<DailyCurriculumItem | null>(null)
const nextChallengeLesson = ref<SkillChallengeLesson | null>(null)

const lessonId = computed(() => String(route.params.lessonId ?? ''))
const categoryId = computed(() => String(route.params.categoryId ?? ''))
const challengeTrackId = computed(() => {
  const value = String(route.query.challenge ?? '')
  return isSkillChallengeTrackId(value) ? value : null
})

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
onMounted(() => {
  const valid =
    session.progressState.isCompleted &&
    session.progressState.lessonId === lessonId.value &&
    session.progressState.categoryId === categoryId.value
  if (!valid) {
    void router.replace({
      name: 'training-lesson',
      params: { categoryId: categoryId.value, lessonId: lessonId.value },
    })
    return
  }
  if (challengeTrackId.value) {
    skillChallenge.ensureChallenge(challengeTrackId.value, lessonId.value)
    nextChallengeLesson.value = skillChallenge.markLessonComplete(lessonId.value)
  } else {
    nextCurriculumItem.value = dailyCurriculum.markLessonComplete(lessonId.value)
  }
})

const handleRetry = () => {
  // 다시 하기 → 레슨 화면(인트로)으로 이동. startLesson 은 레슨 진입 시 재실행됨
  void router.push({
    name: 'training-lesson',
    params: { categoryId: categoryId.value, lessonId: lessonId.value },
    query: challengeTrackId.value ? { challenge: challengeTrackId.value } : undefined,
  })
}

const handleContinue = () => {
  if (challengeTrackId.value) {
    if (!nextChallengeLesson.value) {
      void router.push({
        name: 'skill-challenge-complete',
        query: { track: challengeTrackId.value },
      })
      return
    }

    void router.push({
      name: 'training-lesson',
      params: {
        categoryId: nextChallengeLesson.value.categoryId,
        lessonId: nextChallengeLesson.value.lessonId,
      },
      query: { challenge: challengeTrackId.value },
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
