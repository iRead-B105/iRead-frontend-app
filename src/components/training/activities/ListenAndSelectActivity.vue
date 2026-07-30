<script setup lang="ts">
import { computed } from 'vue'
import type { TrainingChoice, TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import SoundButton from '../SoundButton.vue'
import LetterCard from '../LetterCard.vue'
import ResourceRequired from '../ResourceRequired.vue'
import soundIcon from '@/assets/icons/sound-listen.svg'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

const session = useTrainingSession()
const { progressState } = session
const choices = computed<TrainingChoice[]>(() => props.question.choices ?? [])
const hasWordChoices = computed(() => choices.value.some((choice) => !choice.letter && choice.text))
const isAnswered = computed(() => progressState.isCurrentCorrect === true)
const showAnswerHint = (choice: TrainingChoice) =>
  progressState.hintLevel >= 2 && choice.id === props.question.answer
const targetAudioText = computed(() =>
  props.question.audioText ?? props.question.targetText ?? '',
)

const cardState = (choice: TrainingChoice): 'default' | 'selected' | 'correct' | 'wrong' | 'disabled' => {
  if (isAnswered.value) return choice.id === props.question.answer ? 'correct' : 'disabled'
  if (progressState.selectedAnswer === choice.id) {
    return progressState.isCurrentCorrect === false ? 'wrong' : 'selected'
  }
  return 'default'
}

const handleSelect = (choice: TrainingChoice) => {
  if (!isAnswered.value) session.selectAnswer(choice.id)
}
</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <div class="activity-heading">
      <div>
        <h1>{{ question.instruction }}</h1>
        <p v-if="question.subInstruction">{{ question.subInstruction }}</p>
      </div>
    </div>

    <div class="activity-main">
      <div class="target-area">
        <div class="target-visual">
          <img v-if="question.targetImage" class="target-image" :src="question.targetImage" :alt="question.targetText || '낱말 그림'" />
          <ResourceRequired v-else-if="question.targetImageLabel" :label="question.targetImageLabel" size="medium" />
          <div v-else class="target-sound-visual" aria-hidden="true">
            <img :src="soundIcon" alt="" />
          </div>
        </div>
        <strong v-if="question.targetText" class="target-word">{{ question.targetText }}</strong>
        <SoundButton
          v-if="targetAudioText"
          :text="targetAudioText"
          size="medium"
          variant="primary"
        />
      </div>

      <div class="choice-panel">
        <div class="choices" :class="{ answered: isAnswered, 'choices--words': hasWordChoices }">
          <template v-for="choice in choices" :key="choice.id">
            <div
              v-if="!choice.letter && choice.text"
              class="word-choice"
              :class="[
                `word-choice--${cardState(choice)}`,
                { 'answer-hint': showAnswerHint(choice) },
              ]"
            >
              <SoundButton
                v-if="question.choiceAudioEnabled !== false"
                :text="choice.text"
                size="medium"
                variant="ghost"
                :disabled="isAnswered"
              />
              <button
                class="word-select"
                type="button"
                :disabled="isAnswered"
                :aria-pressed="progressState.selectedAnswer === choice.id"
                :aria-label="`${choice.text} 선택`"
                @click="handleSelect(choice)"
              >
                <img
                  v-if="choice.imageUrl"
                  class="word-choice-image"
                  :src="choice.imageUrl"
                  :alt="choice.text"
                />
                <strong>{{ choice.text }}</strong>
              </button>
            </div>
            <LetterCard
              v-else
              :jamo="choice.letter?.jamo ?? ''"
              :type="choice.letter?.type ?? 'consonant'"
              :state="cardState(choice)"
              :class="{ 'answer-hint': showAnswerHint(choice) }"
              :selectable="!isAnswered"
              size="large"
              surface="choice"
              @select="handleSelect(choice)"
            />
          </template>
        </div>
      </div>
    </div>

    <div class="action-bar">
      <button
        v-if="!isAnswered"
        class="action action--primary"
        type="button"
        :disabled="!session.canSubmit.value"
        @click="session.submitAnswer()"
      >
        선택하기
      </button>
      <button v-else class="action action--next" type="button" @click="$emit('next')">
        다음 문제
      </button>
    </div>
  </section>
</template>

<style scoped src="@/styles/training/activities/ListenAndSelectActivity.css"></style>
