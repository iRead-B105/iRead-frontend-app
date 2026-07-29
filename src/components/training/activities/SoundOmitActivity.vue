<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

const session = useTrainingSession()
const { progressState } = session
const { isPlaying, replay } = useAudioPlayer()
const omittedIndex = ref<number | null>(null)

const parts = computed(() => props.question.soundParts ?? [])
const isAnswered = computed(() => progressState.isCurrentCorrect === true)
const isWrong = computed(() => progressState.isCurrentCorrect === false)
const resultText = computed(() =>
  parts.value.filter((_, index) => index !== omittedIndex.value).join(''),
)

watch(
  () => props.question.id,
  () => {
    omittedIndex.value = null
  },
  { immediate: true },
)

const choosePart = (index: number) => {
  if (isAnswered.value) return
  omittedIndex.value = index
  session.selectAnswer(resultText.value)
}

const playSource = async () => {
  if (!isPlaying.value && props.question.targetText) {
    await replay(props.question.targetText, 0.76)
  }
}

const playTarget = async () => {
  if (!isPlaying.value && props.question.audioText) {
    await replay(props.question.audioText, 0.72)
  }
}
</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <header class="activity-heading">
      <h1>{{ question.instruction }}</h1>
      <p v-if="question.subInstruction">{{ question.subInstruction }}</p>
    </header>

    <div class="play-area">
      <div class="word-panel">
        <button class="source-listen" type="button" :disabled="isPlaying" @click="playSource">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M7 12h6l8-6v20l-8-6H7z" fill="currentColor" />
            <path d="M24 11c3 3 3 7 0 10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
          </svg>
          <span>{{ question.targetText }}</span>
        </button>

        <div class="source-parts" aria-label="원래 낱말의 소리 조각">
          <button
            v-for="(part, index) in parts"
            :key="`${part}-${index}`"
            class="part-card"
            :class="{
              omitted: omittedIndex === index,
              correct: isAnswered && omittedIndex === index,
              wrong: isWrong && omittedIndex === index,
            }"
            type="button"
            :disabled="isAnswered"
            :aria-pressed="omittedIndex === index"
            :aria-label="`${part} 소리 빼기`"
            @click="choosePart(index)"
          >
            <span>{{ part }}</span>
            <svg v-if="omittedIndex === index" viewBox="0 0 64 64" aria-hidden="true">
              <path d="M15 15l34 34M49 15L15 49" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div class="target-panel">
        <button class="target-listen" type="button" :disabled="isPlaying" @click="playTarget">
          <span class="speaker" aria-hidden="true">
            <svg viewBox="0 0 32 32">
              <path d="M7 12h6l8-6v20l-8-6H7z" fill="currentColor" />
              <path d="M24 11c3 3 3 7 0 10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
            </svg>
          </span>
          <span>이 소리 만들기</span>
        </button>

        <div class="arrow" aria-hidden="true">→</div>

        <div
          class="result-card"
          :class="{ ready: omittedIndex !== null, correct: isAnswered, wrong: isWrong }"
          aria-live="polite"
        >
          {{ omittedIndex === null ? '?' : resultText }}
        </div>
      </div>
    </div>

    <div class="action-bar">
      <button
        v-if="!isAnswered"
        class="action action--primary"
        type="button"
        :disabled="omittedIndex === null"
        @click="session.submitAnswer()"
      >
        확인
      </button>
      <button v-else class="action action--next" type="button" @click="$emit('next')">
        다음 문제
      </button>
    </div>
  </section>
</template>

<style scoped src="@/styles/training/activities/SoundOmitActivity.css"></style>
