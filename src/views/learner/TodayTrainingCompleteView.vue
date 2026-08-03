<script setup lang="ts">
import { useRouter } from 'vue-router'
import completeRabbit from '@/assets/training/ui/training-complete-rabbit.png'

const router = useRouter()
</script>

<template>
  <main class="today-complete">
    <section class="complete-card">
      <div class="celebration" aria-hidden="true">
        <img :src="completeRabbit" alt="" />
      </div>
      <p>오늘의 학습 완료</p>
      <h1>오늘도 끝까지 해냈어!</h1>
      <span>모든 훈련을 마쳤어.</span>
      <button type="button" @click="router.push({ name: 'learner-home' })">
        홈으로 가기
      </button>
    </section>
  </main>
</template>

<style scoped src="@/styles/training/TodayTrainingCompleteView.css"></style>
