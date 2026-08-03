<script setup lang="ts">
// 훈련 완료 화면
// 목업 완료 타임스탬프와 축하 메시지를 보여줍니다.
// 점수/진단 결과/통계는 표시하지 않습니다.

import completeRabbit from '@/assets/training/ui/training-complete-rabbit.png'
import progressStar from '@/assets/training/ui/progress-star.png'

withDefaults(
  defineProps<{
    lessonTitle: string
    completedAt: string | null // 목업 타임스탬프(ISO)
    completionMessage?: string
    primaryLabel?: string
    perfect?: boolean
  }>(),
  {
    completionMessage: '훈련을 끝까지 해냈어!',
    primaryLabel: '다음 훈련 시작',
    perfect: false,
  },
)

defineEmits<{ retry: []; continue: [] }>()

</script>

<template>
  <main class="complete-screen">
    <section class="complete-card" :class="{ 'complete-card--perfect': perfect }">
      <div v-if="perfect" class="perfect-stars" aria-hidden="true">
        <img v-for="index in 3" :key="index" :src="progressStar" alt="" />
      </div>

      <div class="complete-emblem">
        <img :src="completeRabbit" alt="" aria-hidden="true" />
      </div>

      <h1 class="complete-title">
        {{ perfect ? '다섯 문제 모두 맞혔어!' : '정말 잘했어!' }}
      </h1>
      <p class="complete-message">
        {{ perfect ? '처음부터 끝까지 정말 대단해!' : '끝까지 해낸 네가 정말 멋져!' }}
      </p>

      <div class="complete-actions">
        <button class="action action--secondary" type="button" @click="$emit('retry')">
          다시 할래요
        </button>
        <button class="action action--primary" type="button" @click="$emit('continue')">
          {{ primaryLabel }}
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped src="@/styles/training/TrainingComplete.css"></style>
