<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getSkillChallengeTrack,
  isSkillChallengeTrackId,
  useSkillChallenge,
} from '@/composables/useSkillChallenge'
import completeRabbit from '@/assets/training/ui/training-complete-rabbit.png'

const route = useRoute()
const router = useRouter()
const challenge = useSkillChallenge()

const trackId = computed(() => String(route.query.track ?? ''))
const track = computed(() =>
  isSkillChallengeTrackId(trackId.value)
    ? getSkillChallengeTrack(trackId.value)
    : challenge.activeTrack.value,
)

const finish = () => {
  void router.push({ name: 'learner-home' })
}
</script>

<template>
  <main class="challenge-complete">
    <section class="challenge-complete__panel">
      <div class="challenge-complete__badge" aria-hidden="true">
        <img :src="completeRabbit" alt="" />
      </div>
      <p class="challenge-complete__eyebrow">실력 검증 완료</p>
      <h1>{{ track?.title ?? '선택한' }} 훈련을<br />모두 해냈어!</h1>
      <p>끝까지 집중해서 정말 멋져요.</p>
      <div class="challenge-complete__summary">
        <span>완료한 훈련</span>
        <strong>{{ challenge.completedCount.value }}개</strong>
      </div>
      <button type="button" @click="finish">섬으로 돌아가기</button>
    </section>
  </main>
</template>

<style scoped src="@/styles/training/SkillChallengeCompleteView.css"></style>
