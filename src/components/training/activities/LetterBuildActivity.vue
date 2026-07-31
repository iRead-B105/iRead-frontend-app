<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import type { LetterBuildSlot, TrainingChoice, TrainingQuestion } from '@/types/training'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useTrainingSession } from '@/composables/useTrainingSession'
import SoundButton from '../SoundButton.vue'
import soundControlPanel from '@/assets/training/sound-puzzle/sound-control-panel.svg'
import completeButtonDisabled from '@/assets/training/sound-puzzle/complete-button-disabled.png'
import completeButtonActive from '@/assets/training/sound-puzzle/complete-button-active.png'
import completeButtonSuccess from '@/assets/training/sound-puzzle/complete-button-success.png'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

const session = useTrainingSession()
const audio = useAudioPlayer()
const placements = reactive<Record<string, string>>({})
const draggedChoiceId = ref<string | null>(null)
const activeSlotId = ref<string | null>(null)
const suppressClickSlotId = ref<string | null>(null)
const dragPreview = ref<HTMLElement | null>(null)

const slots = computed<LetterBuildSlot[]>(() => props.question.buildSlots ?? [])
const sourceChoices = computed<TrainingChoice[]>(() => props.question.choices ?? [])

const compoundJamo: Record<string, string[]> = {
  ㄳ: ['ㄱ', 'ㅅ'],
  ㄵ: ['ㄴ', 'ㅈ'],
  ㄶ: ['ㄴ', 'ㅎ'],
  ㄺ: ['ㄹ', 'ㄱ'],
  ㄻ: ['ㄹ', 'ㅁ'],
  ㄼ: ['ㄹ', 'ㅂ'],
  ㄽ: ['ㄹ', 'ㅅ'],
  ㄾ: ['ㄹ', 'ㅌ'],
  ㄿ: ['ㄹ', 'ㅍ'],
  ㅀ: ['ㄹ', 'ㅎ'],
  ㅄ: ['ㅂ', 'ㅅ'],
  ㅘ: ['ㅗ', 'ㅏ'],
  ㅙ: ['ㅗ', 'ㅐ'],
  ㅚ: ['ㅗ', 'ㅣ'],
  ㅝ: ['ㅜ', 'ㅓ'],
  ㅞ: ['ㅜ', 'ㅔ'],
  ㅟ: ['ㅜ', 'ㅣ'],
  ㅢ: ['ㅡ', 'ㅣ'],
}

interface VisualBuildSlot extends LetterBuildSlot {
  sourceSlotId: string
  partIndex: number
  answerText: string
}

const splitJamo = (text: string): string[] => compoundJamo[text] ?? [text]
const choiceText = (choice: TrainingChoice | undefined): string =>
  choice?.text ?? choice?.letter?.jamo ?? ''
const sourceChoiceById = (id: string) => sourceChoices.value.find((choice) => choice.id === id)
const visualChoiceId = (sourceId: string, partIndex: number, text: string) =>
  `${sourceId}--part-${partIndex}-${text}`

const visualSlots = computed<VisualBuildSlot[]>(() =>
  slots.value.flatMap((slot) => {
    const answerText = choiceText(sourceChoiceById(slot.answerChoiceId)) || slot.hintText
    return splitJamo(answerText).map((part, partIndex) => ({
      ...slot,
      id: `${slot.id}--part-${partIndex}`,
      sourceSlotId: slot.id,
      partIndex,
      answerText: part,
      answerChoiceId: visualChoiceId(slot.answerChoiceId, partIndex, part),
    }))
  }),
)

const medialAnswerText = computed(() => {
  const medialSlot = slots.value.find((slot) => slot.role === 'medial')
  return medialSlot ? choiceText(sourceChoiceById(medialSlot.answerChoiceId)) : ''
})
const hasCompoundMedial = computed(() => splitJamo(medialAnswerText.value).length > 1)
const usesVerticalStack = computed(
  () => !hasCompoundMedial.value && ['ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ'].includes(medialAnswerText.value),
)

const choices = computed<TrainingChoice[]>(() => {
  const result = sourceChoices.value.flatMap((choice) =>
    splitJamo(choiceText(choice)).map((part, partIndex) => ({
      ...choice,
      id: visualChoiceId(choice.id, partIndex, part),
      text: part,
    })),
  )
  const existingTexts = new Set(result.map((choice) => choice.text))
  const fillerJamo = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ']
  for (const jamo of fillerJamo) {
    if (result.length >= 8) break
    if (existingTexts.has(jamo)) continue
    result.push({ id: `extra-${jamo}--part-0-${jamo}`, text: jamo })
    existingTexts.add(jamo)
  }
  return result
})
const isCorrect = computed(() => session.progressState.isCurrentCorrect === true)
const allFilled = computed(() => visualSlots.value.every((item) => Boolean(placements[item.id])))
const usedChoiceIds = computed(() => new Set(Object.values(placements)))
const canSubmit = computed(() => allFilled.value && !isCorrect.value)
const completeButtonImage = computed(() => {
  if (isCorrect.value) return completeButtonSuccess
  return canSubmit.value ? completeButtonActive : completeButtonDisabled
})

const choiceById = (id: string | undefined) => choices.value.find((item) => item.id === id)
const textFor = (id: string | undefined) => choiceById(id)?.text ?? ''
const isAnswerCard = (choiceId: string) =>
  visualSlots.value.some((item) => item.answerChoiceId === choiceId)

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
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    const source = event.currentTarget
    if (source instanceof HTMLElement) {
      const preview = source.cloneNode(true) as HTMLElement
      preview.classList.add('letter-chip--drag-preview')
      document.body.appendChild(preview)
      event.dataTransfer.setDragImage(preview, preview.offsetWidth / 2, preview.offsetHeight / 2)
      dragPreview.value = preview
    }
  }
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
  const placedSlot = visualSlots.value.find((slot) => placements[slot.id] === choiceId)
  if (placedSlot) {
    delete placements[placedSlot.id]
    session.selectAnswer('배치 중')
    return
  }
  const targetSlot =
    visualSlots.value.find((slot) => !placements[slot.id]) ?? visualSlots.value[0]
  if (!targetSlot) return
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
  dragPreview.value?.remove()
  dragPreview.value = null
}

onMounted(() => window.addEventListener('pointerup', releasePointer))
onUnmounted(() => window.removeEventListener('pointerup', releasePointer))

const submit = async () => {
  if (!allFilled.value || isCorrect.value) return
  const correctArrangement = visualSlots.value.every(
    (item) => textFor(placements[item.id]) === item.answerText,
  )
  const arrangedValue = visualSlots.value.map((item) => textFor(placements[item.id])).join('|')
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

    <div class="play-area">
      <div class="build-panel">
        <div
          class="slot-row"
          :class="{
            'slot-row--wrong': session.progressState.isCurrentCorrect === false,
            'slot-row--vertical-stack': usesVerticalStack,
            'slot-row--compound-medial': hasCompoundMedial,
          }"
        >
          <template v-for="(buildSlot, index) in visualSlots" :key="buildSlot.id">
            <button
              class="build-slot"
              :class="{
                [`build-slot--${buildSlot.role}`]: true,
                [`build-slot--part-${buildSlot.partIndex}`]: true,
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

        </div>

        <div
          class="card-pool"
          :class="{ 'card-pool--dragging': draggedChoiceId }"
          aria-label="끌어 놓을 글자 카드"
        >
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
            @dragend="releasePointer"
            @pointerdown="startPointerDrag(choice.id)"
            @click="placeChoiceByClick(choice.id)"
            @keydown.enter.prevent="placeChoiceByClick(choice.id)"
            @keydown.space.prevent="placeChoiceByClick(choice.id)"
          >
            {{ choice.text }}
          </div>
        </div>

        <p
          v-if="session.progressState.isCurrentCorrect === false"
          class="build-feedback"
          role="status"
        >
          카드를 다시 놓아봐!
        </p>
      </div>

      <div class="function-panel">
        <div class="sound-control-card">
          <img :src="soundControlPanel" alt="" aria-hidden="true" />
          <SoundButton
            :text="question.audioText ?? ''"
            size="large"
            variant="primary"
            label="만들 글자 소리 듣기"
          />
        </div>

        <button
          class="complete-button"
          :class="{ 'complete-button--success': isCorrect }"
          type="button"
          :disabled="!canSubmit"
          @click="submit"
        >
          <img :src="completeButtonImage" alt="" aria-hidden="true" />
          <span>완성!</span>
        </button>
      </div>
    </div>

    <button
      v-if="isCorrect"
      class="shared-next-source"
      type="button"
      tabindex="-1"
      aria-hidden="true"
      @click="$emit('next')"
    ></button>
  </section>
</template>

<style scoped src="@/styles/training/activities/LetterBuildActivity.css"></style>
