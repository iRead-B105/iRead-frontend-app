<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import arrowRightIcon from '@/assets/icons/arrow-right.svg'
import closeIcon from '@/assets/icons/close.svg'
import SoundButton from '../SoundButton.vue'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

const session = useTrainingSession()
const { progressState } = session
const { isPlaying } = useAudioPlayer()
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

</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <header class="activity-heading">
      <h1>{{ question.instruction }}</h1>
      <p v-if="question.subInstruction">{{ question.subInstruction }}</p>
    </header>

    <div class="play-area">
      <div class="word-panel">
        <div class="source-listen">
          <span>{{ question.targetText }}</span>
          <SoundButton
            :text="question.targetText || ''"
            :rate="0.76"
            :disabled="isPlaying"
            size="medium"
            variant="ghost"
            label="원래 낱말"
          />
        </div>

        <div class="source-parts choices" aria-label="원래 낱말의 소리 조각">
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
            <img v-if="omittedIndex === index" :src="closeIcon" alt="" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="target-panel">
        <div class="target-listen">
          <SoundButton
            :text="question.audioText || ''"
            :rate="0.72"
            :disabled="isPlaying || !question.audioText"
            size="medium"
            variant="ghost"
            label="만들 소리"
          />
          <span>이 소리 만들기</span>
        </div>

        <img class="arrow" :src="arrowRightIcon" alt="" aria-hidden="true" />

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
