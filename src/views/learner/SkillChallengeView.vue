<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  getSkillChallengeLessons,
  skillChallengeTracks,
  useSkillChallenge,
  type SkillChallengeTrack,
} from '@/composables/useSkillChallenge'
import listeningEarImage from '@/assets/challenge/challenge-listening-ear.png'
import sentenceCardsImage from '@/assets/challenge/challenge-sentence-cards.png'
import readingBooksImage from '@/assets/challenge/challenge-reading-books.png'
import { learnerDataSource } from '@/config/learnerDataSource'
import {
  learnerTestRepository,
  type LearnerSkillChallengePlan,
} from '@/features/learner/test'
import { getCachedStudent } from '@/services/learnerDataRepository'

const router = useRouter()
const challenge = useSkillChallenge()
const isApiMode = learnerDataSource === 'api'
const plan = ref<LearnerSkillChallengePlan | null>(null)
const loading = ref(isApiMode)
const loadError = ref('')

const startTrack = (track: SkillChallengeTrack) => {
  const firstLesson = isApiMode
    ? getSkillChallengeLessons(track.id)[0] ?? null
    : challenge.startChallenge(track.id)
  if (!firstLesson) return
  const testId = plan.value?.tracks.find(
    (serverTrack) => serverTrack.trackCode === track.id,
  )?.nextTestId
  if (isApiMode && !testId) return

  void router.push({
    name: 'skill-challenge-lesson',
    params: {
      trackId: track.id,
      testId: testId ?? 'mock',
      ...(isApiMode ? {} : { lessonId: firstLesson.lessonId }),
    },
  })
}

const getTrackLessonCount = (track: SkillChallengeTrack) => {
  return getSkillChallengeLessons(track.id).length
}

const trackImages: Record<SkillChallengeTrack['id'], string> = {
  phonological: listeningEarImage,
  'short-text': sentenceCardsImage,
  fluency: readingBooksImage,
}

const serverTrack = (track: SkillChallengeTrack) =>
  plan.value?.tracks.find((item) => item.trackCode === track.id)

onMounted(async () => {
  if (!isApiMode) return
  try {
    plan.value = await learnerTestRepository.getChallengePlan(
      getCachedStudent().studentId,
    )
  } catch (error) {
    loadError.value = error instanceof Error
      ? error.message
      : '실력도전 목록을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="skill-challenge">
    <section class="challenge-panel">
      <header class="challenge-heading">
        <span class="challenge-kicker">실력 검증</span>
        <h1>어떤 실력을 확인해볼까요?</h1>
        <p>하나를 고르면 세 문제로 실력을 확인해요.</p>
      </header>

      <p v-if="loading" role="status">실력도전을 준비하고 있어요.</p>
      <p v-else-if="loadError" role="alert">{{ loadError }}</p>

      <div v-else class="challenge-grid">
        <button
          v-for="track in skillChallengeTracks"
          :key="track.id"
          class="challenge-card"
          :class="`challenge-card--${track.color}`"
          type="button"
          :disabled="isApiMode && !serverTrack(track)?.nextTestId"
          @click="startTrack(track)"
        >
          <img class="challenge-card__illustration" :src="trackImages[track.id]" alt="" aria-hidden="true" />
          <span class="challenge-card__content">
            <strong>{{ track.title }}</strong>
            <small>{{ track.shortLabel }}</small>
          </span>
          <span class="challenge-card__footer">
            <b v-if="isApiMode">
              {{ serverTrack(track)?.completedQuestions ?? 0 }}
              / {{ serverTrack(track)?.totalQuestions ?? 3 }}문제
            </b>
            <b v-else>{{ getTrackLessonCount(track) }}개 훈련</b>
            <i aria-hidden="true">→</i>
          </span>
        </button>
      </div>

      <p class="challenge-note">
        점수는 화면에 보여주지 않아요. 편안하게 끝까지 해보면 돼요!
      </p>
    </section>
  </main>
</template>

<style scoped src="@/styles/training/SkillChallengeView.css"></style>
