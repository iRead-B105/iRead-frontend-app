<script setup lang="ts">
import { useRouter } from 'vue-router'
import completeRabbit from '@/assets/training/ui/training-complete-rabbit.png'

const router = useRouter()

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
      <h1>실력 도전 9문제를<br />모두 해냈어요!</h1>
      <p>끝까지 집중해서 정말 멋져요.</p>
      <div class="challenge-complete__summary">
        <span>완료한 훈련</span>
        <strong>9개</strong>
      </div>
      <button type="button" @click="finish">섬으로 돌아가기</button>
    </section>
  </main>
</template>

<style scoped src="@/styles/training/SkillChallengeCompleteView.css"></style>
