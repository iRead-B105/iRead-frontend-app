<script setup lang="ts">
// 서브메뉴 레슨 카드
// 준비된 레슨은 선택(select) 이벤트를, 준비 중 레슨은 not-ready 이벤트를 발생시킵니다.
// 준비 중인 레슨은 클릭 가능하지만 "이 훈련은 준비하고 있어요." 안내만 보여줍니다.

import { computed } from 'vue'
import type { TrainingLessonSummary } from '@/types/training'
import checkIcon from '@/assets/icons/check.svg'
import pendingIcon from '@/assets/icons/pending.svg'
import arrowRightIcon from '@/assets/icons/arrow-right.svg'

const props = defineProps<{
  lesson: TrainingLessonSummary
}>()

const emit = defineEmits<{
  select: [lessonId: string]
  'not-ready': [lessonId: string]
}>()

const isReady = computed(() => props.lesson.isReady)

const handleClick = () => {
  if (isReady.value) {
    emit('select', props.lesson.id)
  } else {
    emit('not-ready', props.lesson.id)
  }
}
</script>

<template>
  <button
    class="lesson-card"
    :class="{ 'is-not-ready': !isReady }"
    type="button"
    :aria-label="isReady ? `${lesson.title} 시작하기` : `${lesson.title}, 이 훈련은 준비하고 있어요.`"
    @click="handleClick"
  >
    <span class="lesson-icon" aria-hidden="true">
      <img :src="isReady ? checkIcon : pendingIcon" alt="" />
    </span>
    <span class="lesson-content">
      <span class="lesson-title">{{ lesson.title }}</span>
      <span class="lesson-description">{{ lesson.description }}</span>
      <span v-if="!isReady" class="lesson-status">이 훈련은 준비하고 있어요.</span>
      <span v-else class="lesson-duration">약 {{ lesson.estimatedMinutes }}분</span>
    </span>
    <span v-if="isReady" class="lesson-arrow" aria-hidden="true">
      <img :src="arrowRightIcon" alt="" />
    </span>
  </button>
</template>

<style scoped src="@/styles/training/TrainingLessonCard.css"></style>
