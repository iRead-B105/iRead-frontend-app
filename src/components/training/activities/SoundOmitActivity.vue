<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import SoundButton from '../SoundButton.vue'
import puzzleFrontYellow from '@/assets/training/sound-puzzle/puzzle-front-yellow.svg'
import puzzleMiddleYellow from '@/assets/training/sound-puzzle/puzzle-middle-yellow.svg'
import puzzleRearYellow from '@/assets/training/sound-puzzle/puzzle-rear-yellow.svg'
import puzzleFrontMint from '@/assets/training/sound-puzzle/puzzle-front-mint.svg'
import puzzleMiddleMint from '@/assets/training/sound-puzzle/puzzle-middle-mint.svg'
import puzzleRearMint from '@/assets/training/sound-puzzle/puzzle-rear-mint.svg'
import puzzleFrontPurple from '@/assets/training/sound-puzzle/puzzle-front-purple.svg'
import puzzleMiddlePurple from '@/assets/training/sound-puzzle/puzzle-middle-purple.svg'
import puzzleRearPurple from '@/assets/training/sound-puzzle/puzzle-rear-purple.svg'
import trashTool from '@/assets/training/sound-puzzle/tool-trash.png'
import undoToolActive from '@/assets/training/sound-puzzle/tool-undo-active.png'
import undoToolDisabled from '@/assets/training/sound-puzzle/tool-undo-disabled.png'
import soundControlPanel from '@/assets/training/sound-puzzle/sound-control-panel.svg'
import completeButtonDisabled from '@/assets/training/sound-puzzle/complete-button-disabled.png'
import completeButtonActive from '@/assets/training/sound-puzzle/complete-button-active.png'
import completeButtonSuccess from '@/assets/training/sound-puzzle/complete-button-success.png'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

const session = useTrainingSession()
const { progressState } = session
const { isPlaying } = useAudioPlayer()
const removedIndices = ref<number[]>([])
const draggingIndex = ref<number | null>(null)
const dragStart = ref({ x: 0, y: 0 })
const dragOffset = ref({ x: 0, y: 0 })
const trashZone = ref<HTMLElement | null>(null)

const parts = computed(() => props.question.soundParts ?? [])
const isAnswered = computed(() => progressState.isCurrentCorrect === true)
const isWrong = computed(() => progressState.isCurrentCorrect === false)
const resultText = computed(() =>
  parts.value.filter((_, index) => !removedIndices.value.includes(index)).join(''),
)
type PuzzleRole = 'front' | 'middle' | 'rear'
type PuzzleColor = 'yellow' | 'mint' | 'purple'

const puzzleAssets: Record<PuzzleColor, Record<PuzzleRole, string>> = {
  yellow: {
    front: puzzleFrontYellow,
    middle: puzzleMiddleYellow,
    rear: puzzleRearYellow,
  },
  mint: {
    front: puzzleFrontMint,
    middle: puzzleMiddleMint,
    rear: puzzleRearMint,
  },
  purple: {
    front: puzzleFrontPurple,
    middle: puzzleMiddlePurple,
    rear: puzzleRearPurple,
  },
}
const puzzleColors: PuzzleColor[] = ['yellow', 'mint', 'purple']
const roleAt = (index: number, count: number): PuzzleRole => {
  if (index === 0) return 'front'
  if (index === count - 1) return 'rear'
  return 'middle'
}
const assetFor = (colorIndex: number, role: PuzzleRole) =>
  puzzleAssets[puzzleColors[colorIndex % puzzleColors.length] ?? 'yellow'][role]
const visiblePieces = computed(() => {
  const visible = parts.value
    .map((text, originalIndex) => ({ text, originalIndex }))
    .filter(({ originalIndex }) => !removedIndices.value.includes(originalIndex))
  return visible.map((piece, index) => ({
    ...piece,
    role: roleAt(index, visible.length),
  }))
})
const canUndo = computed(() => removedIndices.value.length > 0 && !isAnswered.value)
const canSubmit = computed(() => removedIndices.value.length > 0 && !isAnswered.value)
const completeButtonImage = computed(() => {
  if (isAnswered.value) return completeButtonSuccess
  return canSubmit.value ? completeButtonActive : completeButtonDisabled
})

watch(
  () => props.question.id,
  () => {
    removedIndices.value = []
    draggingIndex.value = null
    dragOffset.value = { x: 0, y: 0 }
  },
  { immediate: true },
)

const syncAnswer = () => {
  if (removedIndices.value.length === 0) {
    progressState.selectedAnswer = null
    progressState.isCurrentCorrect = null
    return
  }
  const expectedResult = props.question.targetResult ?? props.question.answer
  session.selectAnswer(
    resultText.value === expectedResult ? props.question.answer : resultText.value,
  )
}

const removePiece = (index: number) => {
  if (isAnswered.value || removedIndices.value.includes(index)) return
  removedIndices.value = [...removedIndices.value, index]
  syncAnswer()
}

const undoRemoval = () => {
  if (!canUndo.value) return
  removedIndices.value = removedIndices.value.slice(0, -1)
  syncAnswer()
}

const beginDrag = (index: number, event: PointerEvent) => {
  if (isAnswered.value) return
  draggingIndex.value = index
  dragStart.value = { x: event.clientX, y: event.clientY }
  dragOffset.value = { x: 0, y: 0 }
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
}

const moveDrag = (event: PointerEvent) => {
  if (draggingIndex.value === null) return
  dragOffset.value = {
    x: event.clientX - dragStart.value.x,
    y: event.clientY - dragStart.value.y,
  }
}

const finishDrag = (event: PointerEvent) => {
  const index = draggingIndex.value
  if (index === null) return
  const rect = trashZone.value?.getBoundingClientRect()
  const droppedInTrash = Boolean(
    rect
      && event.clientX >= rect.left
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.bottom,
  )
  draggingIndex.value = null
  dragOffset.value = { x: 0, y: 0 }
  if (droppedInTrash) removePiece(index)
}

const cancelDrag = () => {
  draggingIndex.value = null
  dragOffset.value = { x: 0, y: 0 }
}
</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <header class="activity-heading">
      <h1>{{ question.instruction }}</h1>
      <p v-if="question.subInstruction">{{ question.subInstruction }}</p>
    </header>

    <div class="play-area">
      <div class="puzzle-column">
        <div class="puzzle-panel">
          <div
            class="puzzle-stage"
            :class="{ 'puzzle-stage--wrong': isWrong, 'puzzle-stage--correct': isAnswered }"
          >
            <TransitionGroup name="puzzle" tag="div" class="puzzle-word" aria-label="낱말의 소리 조각">
              <button
                v-for="piece in visiblePieces"
                :key="piece.originalIndex"
                class="puzzle-piece"
                :class="{ dragging: draggingIndex === piece.originalIndex }"
                :style="draggingIndex === piece.originalIndex
                  ? {
                    '--drag-x': `${dragOffset.x}px`,
                    '--drag-y': `${dragOffset.y}px`,
                  }
                  : undefined"
                type="button"
                :disabled="isAnswered"
                :aria-label="`${piece.text} 소리 빼기`"
                @keydown.enter.prevent="removePiece(piece.originalIndex)"
                @keydown.space.prevent="removePiece(piece.originalIndex)"
                @pointerdown.prevent="beginDrag(piece.originalIndex, $event)"
                @pointermove.prevent="moveDrag"
                @pointerup.prevent="finishDrag"
                @pointercancel="cancelDrag"
              >
                <img
                  :src="assetFor(piece.originalIndex, piece.role)"
                  alt=""
                  aria-hidden="true"
                  draggable="false"
                />
                <span>{{ piece.text }}</span>
              </button>
            </TransitionGroup>
          </div>
        </div>

        <div class="puzzle-tools" aria-label="퍼즐 조작 도구">
          <button
            ref="trashZone"
            class="tool-button trash-zone"
            :class="{ 'trash-zone--ready': draggingIndex !== null }"
            type="button"
            tabindex="-1"
            aria-label="퍼즐 조각을 이곳으로 끌어 놓아 제거"
          >
            <img :src="trashTool" alt="" aria-hidden="true" />
          </button>
          <button
            class="tool-button undo-button"
            type="button"
            :disabled="!canUndo"
            aria-label="직전에 제거한 퍼즐 조각 되돌리기"
            @click="undoRemoval"
          >
            <img :src="canUndo ? undoToolActive : undoToolDisabled" alt="" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="function-panel">
        <div class="sound-control-card">
          <img :src="soundControlPanel" alt="" aria-hidden="true" />
          <SoundButton
            :text="question.audioText || ''"
            :rate="0.72"
            :disabled="isPlaying || !question.audioText"
            size="large"
            variant="primary"
            label="만들 낱말 소리 듣기"
          />
        </div>
        <button
          class="complete-button"
          :class="{ 'complete-button--success': isAnswered }"
          type="button"
          :disabled="!canSubmit"
          @click="session.submitAnswer()"
        >
          <img :src="completeButtonImage" alt="" aria-hidden="true" />
          <span>완성!</span>
        </button>
      </div>
    </div>

    <button
      v-if="isAnswered"
      class="shared-next-source"
      type="button"
      tabindex="-1"
      aria-hidden="true"
      @click="$emit('next')"
    ></button>
  </section>
</template>

<style scoped src="@/styles/training/activities/SoundOmitActivity.css"></style>
