<script setup lang="ts">
import { computed } from 'vue'
import type { TrainingChoice, TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import SoundButton from '../SoundButton.vue'
import LetterCard from '../LetterCard.vue'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

const session = useTrainingSession()
const { progressState } = session
const choices = computed<TrainingChoice[]>(() => props.question.choices ?? [])
const isAnswered = computed(() => progressState.isCurrentCorrect === true)

const stateFor = (choice: TrainingChoice): 'default' | 'selected' | 'correct' | 'wrong' | 'disabled' => {
  if (isAnswered.value) return choice.id === props.question.answer ? 'correct' : 'disabled'
  if (progressState.selectedAnswer === choice.id) {
    return progressState.isCurrentCorrect === false ? 'wrong' : 'selected'
  }
  return 'default'
}

const select = (choice: TrainingChoice) => {
  if (!isAnswered.value) session.selectAnswer(choice.id)
}
</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <header class="activity-heading">
      <h1>{{ question.instruction }}</h1>
      <p v-if="question.subInstruction">{{ question.subInstruction }}</p>
    </header>

    <div class="activity-main">
      <div class="listen-panel">
        <div class="sound-orb" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <path d="M13 25h12l15-11v36L25 39H13z" fill="currentColor" />
            <path d="M46 23c4 5 4 13 0 18M52 17c8 9 8 21 0 30" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
          </svg>
        </div>
        <SoundButton :text="question.audioText ?? ''" size="medium" variant="primary" />
      </div>

      <div class="choice-panel">
        <div class="choices">
          <template v-for="choice in choices" :key="choice.id">
            <LetterCard
              v-if="choice.letter"
              :jamo="choice.letter.jamo"
              :type="choice.letter.type"
              :state="stateFor(choice)"
              :selectable="!isAnswered"
              size="large"
              @select="select(choice)"
            />
            <button
              v-else
              class="text-choice"
              :class="`text-choice--${stateFor(choice)}`"
              type="button"
              :disabled="isAnswered"
              @click="select(choice)"
            >
              {{ choice.text }}
            </button>
          </template>
        </div>
      </div>
    </div>

    <div class="action-bar">
      <button v-if="!isAnswered" class="action action--primary" type="button" :disabled="!session.canSubmit.value" @click="session.submitAnswer()">확인</button>
      <button v-else class="action action--next" type="button" @click="$emit('next')">다음 문제</button>
    </div>
  </section>
</template>

<style scoped src="@/styles/training/activities/SoundChoiceActivity.css"></style>
