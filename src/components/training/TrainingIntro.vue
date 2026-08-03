<script setup lang="ts">
// 훈련 도입(인트로) 화면
// 메인 섬 화면처럼 요소를 최소로: 레슨 제목, 짧은 설명, 한 줄 메타(시간·문제 수), 시작 버튼.
// 뒤로가기는 부모(TrainingLessonView)가 통합 관리하므로 여기서는 '시작' 이벤트만 보냅니다.
// 토끼의 응원(인사) 말풍선 역시 부모가 함께 띄워 줍니다.

import { computed } from 'vue'
import type { TrainingLesson } from '@/types/training'
import arrowRightIcon from '@/assets/icons/arrow-right.svg'

const props = defineProps<{
  lesson: TrainingLesson
}>()

defineEmits<{ start: [] }>()

const questionCount = computed(() => props.lesson.questions.length)
</script>

<template>
  <div class="intro-screen">
    <div class="intro-content">
      <h1 class="intro-title">{{ lesson.title }}</h1>
      <p class="intro-desc">{{ lesson.description }}</p>
      <div class="intro-meta" aria-label="훈련 정보">
        <span>약 {{ lesson.estimatedMinutes }}분</span>
        <span>{{ questionCount }}문제</span>
      </div>

      <button class="start-button" type="button" @click="$emit('start')">
        <span>시작해 볼까?</span>
        <img class="start-arrow" :src="arrowRightIcon" alt="" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped src="@/styles/training/TrainingIntro.css"></style>
