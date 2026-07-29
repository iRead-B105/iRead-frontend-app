<script setup lang="ts">
// 훈련 완료 화면
// 목업 완료 타임스탬프와 축하 메시지를 보여줍니다.
// 점수/진단 결과/통계는 표시하지 않습니다.

import completeRabbit from '@/assets/training/ui/training-complete-rabbit.png'

withDefaults(
  defineProps<{
    lessonTitle: string
    completedAt: string | null // 목업 타임스탬프(ISO)
    completionMessage?: string
    primaryLabel?: string
  }>(),
  {
    completionMessage: '훈련을 무사히 마쳤어요!',
    primaryLabel: '다음 훈련 시작',
  },
)

defineEmits<{ retry: []; continue: [] }>()

</script>

<template>
  <main class="complete-screen">
    <section class="complete-card">
      <div class="complete-emblem">
        <img :src="completeRabbit" alt="" aria-hidden="true" />
      </div>

      <h1 class="complete-title">정말 잘했어!</h1>
      <p class="complete-message">끝까지 해낸 네가 정말 멋져!</p>

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
