<script setup lang="ts">
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
import arrowRightIcon from '@/assets/icons/arrow-right.svg'
import { learnerDataSource } from '@/config/learnerDataSource'

const router = useRouter()
const challenge = useSkillChallenge()
const isApiMode = learnerDataSource === 'api'

const startTrack = (track: SkillChallengeTrack) => {
  const firstLesson = challenge.startChallenge(track.id)
  if (!firstLesson) return

  void router.push({
    name: 'training-lesson',
    params: {
      categoryId: firstLesson.categoryId,
      lessonId: firstLesson.lessonId,
    },
    query: { challenge: track.id },
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
</script>

<template>
  <main class="skill-challenge">
    <section class="challenge-panel">
      <header class="challenge-heading">
        <span class="challenge-kicker">실력 검증</span>
        <h1>어떤 실력을 확인해볼까?</h1>
        <p v-if="isApiMode" role="alert">
          백엔드의 검사·훈련 결과를 이 화면의 세 가지 도전 코스에 연결하는 제품 계약이 아직 없어요.
          회사에서 코스 매핑이 확정되면 API 어댑터만 이어서 사용할 수 있습니다.
        </p>
        <p v-else>하나를 고르면 그 안의 훈련을 차례대로 모두 해봐!</p>
      </header>

      <div v-if="!isApiMode" class="challenge-grid">
        <button
          v-for="track in skillChallengeTracks"
          :key="track.id"
          class="challenge-card"
          :class="`challenge-card--${track.color}`"
          type="button"
          @click="startTrack(track)"
        >
          <img class="challenge-card__illustration" :src="trackImages[track.id]" alt="" aria-hidden="true" />
          <span class="challenge-card__content">
            <strong>{{ track.title }}</strong>
            <small>{{ track.shortLabel }}</small>
          </span>
          <span class="challenge-card__footer">
            <b>{{ getTrackLessonCount(track) }}개 훈련</b>
            <img :src="arrowRightIcon" alt="" aria-hidden="true" />
          </span>
        </button>
      </div>

      <p v-if="!isApiMode" class="challenge-note">
        점수는 화면에 보여주지 않아. 편안하게 끝까지 해보면 돼!
      </p>
    </section>
  </main>
</template>

<style scoped src="@/styles/training/SkillChallengeView.css"></style>
