<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { skillChallengeTracks } from '@/composables/useSkillChallenge'
import listeningEarImage from '@/assets/challenge/challenge-listening-ear.png'
import sentenceCardsImage from '@/assets/challenge/challenge-sentence-cards.png'
import readingBooksImage from '@/assets/challenge/challenge-reading-books.png'
import {
  learnerTestRepository,
  type LearnerSkillChallengePlan,
} from '@/features/learner/test'
import { getCachedStudent } from '@/services/learnerDataRepository'
import { useLearnerSessionStore } from '@/stores/learnerSession'

const router = useRouter()
const learnerSession = useLearnerSessionStore()
const plan = ref<LearnerSkillChallengePlan | null>(null)
const loading = ref(true)
const loadError = ref('')

const progress = computed(() => plan.value?.completedQuestions ?? 0)
const actionLabel = computed(() => progress.value > 0 ? '이어하기' : '시작하기')

const startChallenge = () => {
  const trackId = plan.value?.nextTrackCode
  const testId = plan.value?.nextTestId
  if (!trackId || !testId) return

  void router.push({
    name: 'skill-challenge-lesson',
    params: { trackId, testId },
  })
}

const trackImages = {
  phonological: listeningEarImage,
  'short-text': sentenceCardsImage,
  fluency: readingBooksImage,
}

const loadPlan = async () => {
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
        <p>틀려도 괜찮아요, 편안하게 풀어봐요!</p>
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
          </span>
          </article>
        </div>

        <div class="challenge-action">
          <button
            type="button"
            :disabled="!plan?.nextTestId"
            @click="startChallenge"
          >
            {{ actionLabel }}
          </button>
        </div>
      </template>
    </section>
  </main>
</template>

<style scoped src="@/styles/training/SkillChallengeView.css"></style>
