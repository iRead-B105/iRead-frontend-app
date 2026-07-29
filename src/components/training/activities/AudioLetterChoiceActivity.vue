<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import type { TrainingChoice, TrainingQuestion } from '@/types/training'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useTrainingSession } from '@/composables/useTrainingSession'
import LetterCard from '../LetterCard.vue'
import SoundButton from '../SoundButton.vue'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

const session = useTrainingSession()
const audio = useAudioPlayer()
const choices = computed<TrainingChoice[]>(() => props.question.choices ?? [])
const isCorrect = computed(() => session.progressState.isCurrentCorrect === true)

const cardState = (choice: TrainingChoice) => {
  if (isCorrect.value) return choice.id === props.question.answer ? 'correct' : 'disabled'
  if (session.progressState.selectedAnswer === choice.id) {
    return session.progressState.isCurrentCorrect === false ? 'wrong' : 'selected'
  }
  return 'default'
}

const playQuestion = () => {
  if (props.question.audioText) void audio.replay(props.question.audioText, 0.72)
}

const choose = async (choice: TrainingChoice) => {
  if (isCorrect.value) return
  session.selectAnswer(choice.id)
  const correct = await session.submitAnswer()

  if (correct) {
    void audio.speak('맞았어!', 0.9)
  }
}

watch(
  () => props.question.id,
  () => void nextTick(playQuestion),
  { immediate: true },
)
</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <h1>{{ question.instruction }}</h1>

    <div class="learning-area">
      <SoundButton
        :text="question.audioText ?? ''"
        size="large"
        variant="primary"
      />

      <div class="choices" aria-label="글자 선택지">
        <LetterCard
          v-for="choice in choices"
          :key="choice.id"
          :jamo="choice.letter?.jamo ?? ''"
          :type="choice.letter?.type ?? 'consonant'"
          :state="cardState(choice)"
          :selectable="!isCorrect"
          size="large"
          @select="choose(choice)"
        />
      </div>
    </div>

    <div class="action-row">
      <p v-if="session.progressState.isCurrentCorrect === false" role="status">한 번 더 들어봐요.</p>
      <span v-else></span>
      <button v-if="isCorrect" class="next-button" type="button" @click="$emit('next')">
        다음 문제
      </button>
    </div>
  </section>
</template>

<style scoped src="@/styles/training/activities/AudioLetterChoiceActivity.css"></style>
