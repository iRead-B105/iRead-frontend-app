<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  skillChallengeTracks,
  useSkillChallenge,
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
import { useLearnerSessionStore } from '@/stores/learnerSession'

const router = useRouter()
const challenge = useSkillChallenge()
const learnerSession = useLearnerSessionStore()
const isApiMode = learnerDataSource === 'api'
const plan = ref<LearnerSkillChallengePlan | null>(null)
const loading = ref(isApiMode)
const loadError = ref('')

const progress = computed(() => plan.value?.completedQuestions ?? challenge.completedCount.value)
const totalQuestions = computed(() => plan.value?.totalQuestions ?? 9)
const actionLabel = computed(() => progress.value > 0 ? '이어하기' : '시작하기')

const startChallenge = () => {
  const firstLesson = isApiMode ? null : challenge.startChallenge()
  const trackId = isApiMode ? plan.value?.nextTrackCode : firstLesson?.trackId
  const testId = isApiMode ? plan.value?.nextTestId : 'mock'
  if (!trackId || !testId) return

  void router.push({
    name: 'skill-challenge-lesson',
    params: {
      trackId,
      testId,
      ...(firstLesson ? { lessonId: firstLesson.lessonId } : {}),
    },
  })
}

const trackImages = {
  phonological: listeningEarImage,
  'short-text': sentenceCardsImage,
  fluency: readingBooksImage,
}

const loadPlan = async () => {
  if (!isApiMode) return
  loading.value = true
  loadError.value = ''
  try {
    plan.value = await learnerTestRepository.getChallengePlan(
      getCachedStudent().studentId,
    )
    if (plan.value.completed) {
      learnerSession.markChallengeCompleted()
      await router.replace({ name: 'learner-home' })
    }
  } catch (error) {
    loadError.value = error instanceof Error
      ? error.message
      : '실력도전 목록을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
}

onMounted(loadPlan)
</script>

<template>
  <main class="skill-challenge">
    <section class="challenge-panel">
      <header class="challenge-heading">
        <span class="challenge-kicker">실력 검증</span>
        <h1>실력 도전을 시작해볼까요?</h1>
        <p>세 가지 영역에서 모두 9문제를 차례대로 진행해요.</p>
      </header>

      <p v-if="loading" role="status">실력도전을 준비하고 있어요.</p>
      <div v-else-if="loadError" class="challenge-error" role="alert">
        <p>{{ loadError }}</p>
        <button type="button" @click="loadPlan">다시 시도</button>
      </div>

      <template v-else>
        <div class="challenge-grid" aria-label="실력 도전 영역">
          <article
          v-for="track in skillChallengeTracks"
          :key="track.id"
          class="challenge-card"
          :class="`challenge-card--${track.color}`"
        >
          <img class="challenge-card__illustration" :src="trackImages[track.id]" alt="" aria-hidden="true" />
          <span class="challenge-card__content">
            <strong>{{ track.title }}</strong>
            <small>{{ track.shortLabel }}</small>
          </span>
            <span class="challenge-card__footer"><b>3문제</b></span>
          </article>
        </div>

        <div class="challenge-action">
          <strong>{{ progress }} / {{ totalQuestions }}문제</strong>
          <button
            type="button"
            :disabled="isApiMode && !plan?.nextTestId"
            @click="startChallenge"
          >
            {{ actionLabel }}
          </button>
        </div>
      </template>

      <p class="challenge-note">
        점수는 화면에 보여주지 않아요. 편안하게 끝까지 해보면 돼요!
      </p>
    </section>
  </main>
</template>

<style scoped src="@/styles/training/SkillChallengeView.css"></style>
