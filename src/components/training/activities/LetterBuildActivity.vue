<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import type { LetterBuildSlot, TrainingChoice, TrainingQuestion } from '@/types/training'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useTrainingSession } from '@/composables/useTrainingSession'
import SoundButton from '../SoundButton.vue'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

const session = useTrainingSession()
const audio = useAudioPlayer()
const placements = reactive<Record<string, string>>({})
const draggedChoiceId = ref<string | null>(null)
const activeSlotId = ref<string | null>(null)
const suppressClickSlotId = ref<string | null>(null)

const slots = computed<LetterBuildSlot[]>(() => props.question.buildSlots ?? [])
const choices = computed<TrainingChoice[]>(() => props.question.choices ?? [])
const isCorrect = computed(() => session.progressState.isCurrentCorrect === true)
const allFilled = computed(() => slots.value.every((item) => Boolean(placements[item.id])))
const usedChoiceIds = computed(() => new Set(Object.values(placements)))

const choiceById = (id: string | undefined) => choices.value.find((item) => item.id === id)
const textFor = (id: string | undefined) => choiceById(id)?.text ?? ''
const isAnswerCard = (choiceId: string) => slots.value.some((item) => item.answerChoiceId === choiceId)

const clearPlacements = () => {
  Object.keys(placements).forEach((key) => delete placements[key])
  draggedChoiceId.value = null
  activeSlotId.value = null
}

const playQuestion = () => {
  if (props.question.audioText) void audio.replay(props.question.audioText, 0.78)
}

const startDrag = (event: DragEvent, choiceId: string) => {
  if (isCorrect.value) return
  draggedChoiceId.value = choiceId
  event.dataTransfer?.setData('text/plain', choiceId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

const startPointerDrag = (choiceId: string) => {
  if (!isCorrect.value) draggedChoiceId.value = choiceId
}

const placeChoice = (choiceId: string, slotId: string) => {
  Object.keys(placements).forEach((key) => {
    if (placements[key] === choiceId) delete placements[key]
  })
  placements[slotId] = choiceId
  session.selectAnswer('배치 중')
}

const placeChoiceByClick = (choiceId: string) => {
  if (isCorrect.value) return
  const targetSlot = slots.value.find((slot) => choiceId.startsWith(`${slot.id}-`))
  if (!targetSlot) return
  if (placements[targetSlot.id] === choiceId) {
    delete placements[targetSlot.id]
    session.selectAnswer('배치 중')
    return
  }
  placeChoice(choiceId, targetSlot.id)
}

const dropOn = (event: DragEvent, slotId: string) => {
  if (isCorrect.value) return
  const choiceId = event.dataTransfer?.getData('text/plain') || draggedChoiceId.value
  draggedChoiceId.value = null
  activeSlotId.value = null
  if (!choiceId) return
  placeChoice(choiceId, slotId)
}

const dropPointerOn = (slotId: string) => {
  const choiceId = draggedChoiceId.value
  if (!choiceId || isCorrect.value) return
  suppressClickSlotId.value = slotId
  placeChoice(choiceId, slotId)
  draggedChoiceId.value = null
  activeSlotId.value = null
}

const clearSlot = (slotId: string) => {
  if (suppressClickSlotId.value === slotId) {
    suppressClickSlotId.value = null
    return
  }
  if (isCorrect.value || !placements[slotId]) return
  delete placements[slotId]
  session.selectAnswer('배치 중')
}

const releasePointer = () => {
  draggedChoiceId.value = null
  activeSlotId.value = null
}

onMounted(() => window.addEventListener('pointerup', releasePointer))
onUnmounted(() => window.removeEventListener('pointerup', releasePointer))

const submit = async () => {
  if (!allFilled.value || isCorrect.value) return
  const correctArrangement = slots.value.every(
    (item) => placements[item.id] === item.answerChoiceId,
  )
  const arrangedValue = slots.value.map((item) => placements[item.id]).join('|')
  session.selectAnswer(correctArrangement ? props.question.answer : arrangedValue)
  const completed = await session.submitAnswer()

  if (completed) {
    void audio.speak(props.question.combined ?? props.question.audioText ?? '', 0.78)
  } else if (session.progressState.attemptCount >= 2 && session.progressState.hintLevel < 2) {
    session.showHint()
    clearPlacements()
  }
}

watch(
  () => props.question.id,
  () => {
    clearPlacements()
    void nextTick(playQuestion)
  },
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

      <div class="build-panel">
        <div class="slot-row" :class="{ 'slot-row--wrong': session.progressState.isCurrentCorrect === false }">
          <template v-for="(buildSlot, index) in slots" :key="buildSlot.id">
            <span v-if="index" class="plus" aria-hidden="true">+</span>
            <button
              class="build-slot"
              :class="{
                'build-slot--filled': placements[buildSlot.id],
                'build-slot--active': activeSlotId === buildSlot.id,
                'build-slot--hint': session.progressState.hintLevel >= 2,
              }"
              type="button"
              :aria-label="`${index + 1}번째 빈칸${placements[buildSlot.id] ? `, ${textFor(placements[buildSlot.id])} 놓임` : ''}`"
              @dragenter.prevent="activeSlotId = buildSlot.id"
              @dragover.prevent
              @drop.prevent="dropOn($event, buildSlot.id)"
              @pointerenter="draggedChoiceId && (activeSlotId = buildSlot.id)"
              @pointerleave="activeSlotId === buildSlot.id && (activeSlotId = null)"
              @pointerup="dropPointerOn(buildSlot.id)"
              @click="clearSlot(buildSlot.id)"
            >
              <strong v-if="placements[buildSlot.id]">{{ textFor(placements[buildSlot.id]) }}</strong>
              <span v-else-if="session.progressState.hintLevel >= 2" class="slot-hint">{{ buildSlot.hintText }}</span>
              <span v-else class="slot-number">{{ index + 1 }}</span>
            </button>
          </template>

          <span class="equals" aria-hidden="true">=</span>
          <div class="result-card" :class="{ 'result-card--complete': isCorrect }" aria-live="polite">
            {{ isCorrect ? question.combined : '?' }}
          </div>
        </div>

          <div class="card-pool choices" aria-label="끌어 놓을 글자 카드">
          <div
            v-for="choice in choices"
            :key="choice.id"
            class="letter-chip"
            :class="{
              'letter-chip--used': usedChoiceIds.has(choice.id),
              'letter-chip--hint': session.progressState.hintLevel >= 1 && isAnswerCard(choice.id),
            }"
            :draggable="!isCorrect"
            role="button"
            :tabindex="isCorrect ? -1 : 0"
            :aria-label="`${choice.text} 카드`"
            @dragstart="startDrag($event, choice.id)"
            @dragend="activeSlotId = null"
            @pointerdown="startPointerDrag(choice.id)"
            @click="placeChoiceByClick(choice.id)"
            @keydown.enter.prevent="placeChoiceByClick(choice.id)"
            @keydown.space.prevent="placeChoiceByClick(choice.id)"
          >
            {{ choice.text }}
          </div>
        </div>
      </div>
    </div>

    <div class="action-row">
      <p v-if="session.progressState.isCurrentCorrect === false" role="status">카드를 다시 놓아봐!</p>
      <span v-else></span>
      <button v-if="!isCorrect" class="action action--check" type="button" :disabled="!allFilled" @click="submit">
        완성하기
      </button>
      <button v-else class="action action--next" type="button" @click="$emit('next')">
        다음 문제
      </button>
    </div>
  </section>
</template>

<style scoped src="@/styles/training/activities/LetterBuildActivity.css"></style>
