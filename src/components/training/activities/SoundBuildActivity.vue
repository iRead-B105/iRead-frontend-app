<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TrainingChoice, TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

const session = useTrainingSession()
const { progressState } = session
const { isPlaying, playSequence, replay } = useAudioPlayer()

const isSplit = computed(() => Boolean(props.question.targetText))
const choices = computed<TrainingChoice[]>(() => props.question.choices ?? [])
const slotCount = computed(() => props.question.soundParts?.length ?? 2)
const slots = ref<(string | null)[]>([])
const draggedChoiceId = ref<string | null>(null)
const hasPlayedPrompt = ref(false)

const resetSlots = () => {
  slots.value = Array.from({ length: slotCount.value }, () => null)
  draggedChoiceId.value = null
}

watch(() => props.question.id, resetSlots, { immediate: true })

const isAnswered = computed(() => progressState.isCurrentCorrect === true)
const isWrong = computed(() => progressState.isCurrentCorrect === false)
const allFilled = computed(() => slots.value.every(Boolean))
const remainingChoices = computed(() =>
  choices.value.filter((choice) => !slots.value.includes(choice.id)),
)
const placedChoices = computed(() =>
  slots.value.map((id) => choices.value.find((choice) => choice.id === id) ?? null),
)
const assembledText = computed(() =>
  placedChoices.value.map((choice) => choice?.text ?? '').join(''),
)

const syncAnswer = () => {
  progressState.isCurrentCorrect = null
  if (allFilled.value) session.selectAnswer(slots.value.join('|'))
  else progressState.selectedAnswer = null
}

const placeChoice = (choiceId: string, targetIndex?: number) => {
  if (isAnswered.value || slots.value.includes(choiceId)) return
  const index = targetIndex ?? slots.value.findIndex((value) => value === null)
  if (index < 0 || slots.value[index] !== null) return
  const next = [...slots.value]
  next[index] = choiceId
  slots.value = next
  syncAnswer()
}

const removeChoice = (index: number) => {
  if (isAnswered.value || !slots.value[index]) return
  const next = [...slots.value]
  next[index] = null
  slots.value = next
  syncAnswer()
}

const onDragStart = (choiceId: string) => {
  draggedChoiceId.value = choiceId
}

const onDrop = (index: number) => {
  if (draggedChoiceId.value) placeChoice(draggedChoiceId.value, index)
  draggedChoiceId.value = null
}

const playPrompt = async () => {
  if (isPlaying.value) return
  if (isSplit.value && props.question.targetText) {
    await replay(props.question.targetText, 0.75)
    hasPlayedPrompt.value = true
    return
  }
  await playSequence(props.question.soundParts ?? [], 0.68)
  hasPlayedPrompt.value = true
}
</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <header class="activity-heading">
      <h1>{{ question.instruction }}</h1>
      <p v-if="question.subInstruction">{{ question.subInstruction }}</p>
    </header>

    <div class="activity-main">
      <div class="sound-panel">
        <strong v-if="isSplit" class="target-word">{{ question.targetText }}</strong>
        <div v-else class="sound-pieces" aria-hidden="true">
          <template v-for="(_, index) in question.soundParts" :key="index">
            <span class="sound-piece">
              <svg viewBox="0 0 32 32">
                <path d="M7 12h6l8-6v20l-8-6H7z" fill="currentColor" />
                <path d="M24 11c3 3 3 7 0 10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
              </svg>
            </span>
            <span v-if="index < slotCount - 1" class="piece-plus">+</span>
          </template>
        </div>
        <button class="listen-button" type="button" :disabled="isPlaying" @click="playPrompt">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M7 12h6l8-6v20l-8-6H7z" fill="currentColor" />
            <path d="M24 11c3 3 3 7 0 10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
          </svg>
          <span>{{ isPlaying ? '재생 중' : hasPlayedPrompt ? '다시 듣기' : '소리 듣기' }}</span>
        </button>
      </div>

      <div class="build-panel">
        <div class="slot-row" :class="{ 'slot-row--wrong': isWrong }">
          <template v-for="(choice, index) in placedChoices" :key="index">
            <button
              class="sound-slot"
              :class="{ filled: choice, correct: isAnswered }"
              type="button"
              :disabled="isAnswered"
              :aria-label="choice ? `${index + 1}번째 소리 ${choice.text}, 빼기` : `${index + 1}번째 소리 빈칸`"
              @click="removeChoice(index)"
              @dragover.prevent
              @drop="onDrop(index)"
            >
              <span v-if="choice">{{ choice.text }}</span>
              <span v-else class="slot-number">{{ index + 1 }}</span>
            </button>
            <span v-if="index < slotCount - 1" class="slot-plus" aria-hidden="true">+</span>
          </template>

          <template v-if="!isSplit">
            <span class="slot-equals" aria-hidden="true">=</span>
            <div class="result-word" :class="{ revealed: allFilled, correct: isAnswered }" aria-live="polite">
              {{ allFilled ? assembledText : '?' }}
            </div>
          </template>
        </div>

        <div class="source-cards" aria-label="소리 카드">
          <button
            v-for="choice in remainingChoices"
            :key="choice.id"
            class="sound-card"
            type="button"
            :draggable="!isAnswered"
            :disabled="isAnswered"
            :aria-label="`${choice.text} 카드 놓기`"
            @click="placeChoice(choice.id)"
            @dragstart="onDragStart(choice.id)"
            @dragend="draggedChoiceId = null"
          >
            {{ choice.text }}
          </button>
        </div>
      </div>
    </div>

    <div class="action-bar">
      <button
        v-if="!isAnswered"
        class="action action--primary"
        type="button"
        :disabled="!allFilled"
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

<style scoped src="@/styles/training/activities/SoundBuildActivity.css"></style>
