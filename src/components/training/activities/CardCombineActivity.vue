<script setup lang="ts">
// 액티비티: 자음과 모음 합치기 (파닉스)
// 자음/모음 카드를 끌어다 놓거나(드래그 앤 드롭) 눌러서(클릭) 자리에 채우면
// 완성된 글자가 나타나고 자음→모음→완성 글자 소리가 순서대로 재생됩니다.
// 마우스/터치/키보드 모두 지원(클릭이 기본 경로). 다음 레슨 이동은 상위가 처리합니다.

import { computed, ref, watch } from 'vue'
import type { TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import LetterCard from '../LetterCard.vue'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

const session = useTrainingSession()
const { progressState } = session
const { playLetterSound, playSequence } = useAudioPlayer()

const consonant = computed(() => props.question.consonant ?? '')
const vowel = computed(() => props.question.vowel ?? '')
const combined = computed(() => props.question.combined ?? '')

const consonantPlaced = ref(false)
const vowelPlaced = ref(false)
const draggedJamo = ref<string | null>(null)

const isAnswered = computed(() => progressState.isCurrentCorrect === true)
const bothPlaced = computed(() => consonantPlaced.value && vowelPlaced.value)

// 문제가 바뀌면 내부 배치 상태 초기화(컴포넌트 key 로도 remount 되지만 안전하게 이중 처리)
watch(
  () => props.question.id,
  () => {
    consonantPlaced.value = false
    vowelPlaced.value = false
    draggedJamo.value = null
  },
)

const place = async (jamo: string) => {
  if (isAnswered.value) return
  if (jamo === consonant.value && !consonantPlaced.value) {
    consonantPlaced.value = true
    await playLetterSound(consonant.value)
  } else if (jamo === vowel.value && !vowelPlaced.value) {
    vowelPlaced.value = true
    await playLetterSound(vowel.value)
  }
  if (bothPlaced.value && !isAnswered.value) {
    // 완성된 글자 공개 + 자음/모음/완성 글자 소리 순차 재생
    session.selectAnswer(combined.value)
    await playSequence([consonant.value, vowel.value, combined.value])
  }
}

const removeFromSlot = (slot: 'consonant' | 'vowel') => {
  if (isAnswered.value) return
  if (slot === 'consonant') consonantPlaced.value = false
  else vowelPlaced.value = false
  progressState.selectedAnswer = null
  progressState.isCurrentCorrect = null
}

// 드래그 앤 드롭(마우스)
const onDragStart = (jamo: string) => {
  draggedJamo.value = jamo
}
const onDrop = (slot: 'consonant' | 'vowel') => {
  const jamo = draggedJamo.value
  draggedJamo.value = null
  if (!jamo) return
  const expected = slot === 'consonant' ? consonant.value : vowel.value
  // 다른 타입 자리에 놓으면 그냥 무시(부드러운 처리)
  if (jamo === expected) void place(jamo)
}

const handleConfirm = () => session.submitAnswer()
</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <div class="activity-main">
      <div class="instruction">
        <p class="instruction-main">{{ question.instruction }}</p>
        <p v-if="question.subInstruction" class="instruction-sub">{{ question.subInstruction }}</p>
      </div>

      <!-- 완성 자리: 두 슬롯 + 완성된 글자 -->
      <div class="build-area">
        <div class="slots">
          <div
            class="slot"
            :class="{ filled: consonantPlaced }"
            role="button"
            :tabindex="consonantPlaced && !isAnswered ? 0 : undefined"
            :aria-label="`자음 자리 ${consonantPlaced ? consonant + ' 채움' : '비움'}`"
            @dragover.prevent
            @drop="onDrop('consonant')"
            @keydown.enter.prevent="consonantPlaced && removeFromSlot('consonant')"
            @keydown.space.prevent="consonantPlaced && removeFromSlot('consonant')"
            @click="consonantPlaced && removeFromSlot('consonant')"
          >
            <span v-if="!consonantPlaced" class="slot-label">자음 자리</span>
            <LetterCard v-else :jamo="consonant" type="consonant" size="large" />
          </div>

          <span class="plus" aria-hidden="true">+</span>

          <div
            class="slot"
            :class="{ filled: vowelPlaced }"
            role="button"
            :tabindex="vowelPlaced && !isAnswered ? 0 : undefined"
            :aria-label="`모음 자리 ${vowelPlaced ? vowel + ' 채움' : '비움'}`"
            @dragover.prevent
            @drop="onDrop('vowel')"
            @keydown.enter.prevent="vowelPlaced && removeFromSlot('vowel')"
            @keydown.space.prevent="vowelPlaced && removeFromSlot('vowel')"
            @click="vowelPlaced && removeFromSlot('vowel')"
          >
            <span v-if="!vowelPlaced" class="slot-label">모음 자리</span>
            <LetterCard v-else :jamo="vowel" type="vowel" size="large" />
          </div>

          <span class="equals" aria-hidden="true">=</span>

          <div class="result" :class="{ revealed: bothPlaced }">
            <span v-if="bothPlaced" class="result-syllable">{{ combined }}</span>
            <span v-else class="result-placeholder">?</span>
          </div>
        </div>
      </div>

      <!-- 소스 카드 풀(아직 안 채운 카드만) -->
      <div class="source-pool" aria-label="글자 카드">
        <div
          v-if="!consonantPlaced"
          class="source-chip"
          :draggable="!isAnswered"
          role="button"
          tabindex="0"
          :aria-label="`자음 ${consonant} 자리에 놓기`"
          @click="place(consonant)"
          @keydown.enter.prevent="place(consonant)"
          @keydown.space.prevent="place(consonant)"
          @dragstart="onDragStart(consonant)"
        >
          <LetterCard :jamo="consonant" type="consonant" size="medium" />
        </div>
        <div
          v-if="!vowelPlaced"
          class="source-chip"
          :draggable="!isAnswered"
          role="button"
          tabindex="0"
          :aria-label="`모음 ${vowel} 자리에 놓기`"
          @click="place(vowel)"
          @keydown.enter.prevent="place(vowel)"
          @keydown.space.prevent="place(vowel)"
          @dragstart="onDragStart(vowel)"
        >
          <LetterCard :jamo="vowel" type="vowel" size="medium" />
        </div>
      </div>
    </div>

    <div class="action-bar">
      <button
        v-if="!isAnswered"
        class="action action--primary"
        type="button"
        :disabled="!session.canSubmit.value"
        @click="handleConfirm"
      >
        확인
      </button>
      <button v-else class="action action--primary shared-next-source" type="button" @click="$emit('next')">
        다음 문제
      </button>
    </div>
  </section>
</template>

<style scoped src="@/styles/training/activities/CardCombineActivity.css"></style>
