<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { SoundManipulationUnit, TrainingChoice, TrainingQuestion } from '@/types/training'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useTrainingSession } from '@/composables/useTrainingSession'
import SoundButton from '../SoundButton.vue'
import cardYellow from '@/assets/training/choice-cards/choice-card-letter-awning-yellow.webp'
import cardMint from '@/assets/training/choice-cards/choice-card-letter-awning-mint.webp'
import cardPurple from '@/assets/training/choice-cards/choice-card-letter-awning-purple.webp'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

const session = useTrainingSession()
const audio = useAudioPlayer()

// 카드가 끼워진 글자 자리와 카드 (한 번에 한 글자만 바꾼다)
const placedSlotId = ref<string | null>(null)
const placedChoiceId = ref<string | null>(null)
// 탭·키보드 폴백: 카드를 먼저 고른 뒤 글자를 눌러 바꾼다
const pickedChoiceId = ref<string | null>(null)
// 드래그 중인 트레이의 새 소리 카드
const draggingChoiceId = ref<string | null>(null)
const dragStart = ref({ x: 0, y: 0 })
const dragPoint = ref({ x: 0, y: 0 })
// 고스트가 원본 카드와 같은 크기를 유지하도록 드래그 시작 시 기억한다.
const dragSize = ref({ width: 0, height: 0 })
const hoverSlotId = ref<string | null>(null)
const slotElements = new Map<string, HTMLElement>()

const units = computed<SoundManipulationUnit[]>(() => props.question.manipulationUnits ?? [])
const replacements = computed<TrainingChoice[]>(() => props.question.replacementChoices ?? [])
const isCorrect = computed(() => session.progressState.isCurrentCorrect === true)
const targetIds = computed(() => props.question.manipulationTargetUnitIds ?? [])
const canSubmit = computed(() => Boolean(placedSlotId.value && placedChoiceId.value))
const placedText = computed(
  () => replacements.value.find((choice) => choice.id === placedChoiceId.value)?.text ?? '',
)
const ghostText = computed(
  () => replacements.value.find((choice) => choice.id === draggingChoiceId.value)?.text ?? '',
)

// 카드마다 색을 고정한다(제시 순서 기준 3색 순환) — 공통 카드 시스템의 nth-child 색과 동일.
// 트레이 → 드래그 고스트 → 글자 자리 장착까지 같은 카드는 항상 같은 PNG 프레임을 유지한다.
const CARD_IMAGES = [cardYellow, cardMint, cardPurple] as const
const toneStyle = (choiceId: string) => {
  const index = replacements.value.findIndex((choice) => choice.id === choiceId)
  const image = CARD_IMAGES[Math.max(index, 0) % 3]!
  return { '--tone-card-image': `url("${image}")` }
}

const setSlotElement = (unitId: string, el: HTMLElement | null) => {
  if (el) slotElements.set(unitId, el)
  else slotElements.delete(unitId)
}

const playQuestion = () => {
  if (props.question.audioText) void audio.replay(props.question.audioText, 0.82)
}

const resetJudgement = () => session.selectAnswer('조작 중')

const placeCard = (slotId: string, choiceId: string) => {
  if (isCorrect.value) return
  placedSlotId.value = slotId
  placedChoiceId.value = choiceId
  pickedChoiceId.value = null
  resetJudgement()
}

const clearPlacement = () => {
  if (isCorrect.value || !placedSlotId.value) return
  placedSlotId.value = null
  placedChoiceId.value = null
  resetJudgement()
}

const pickCard = (choiceId: string) => {
  if (isCorrect.value) return
  pickedChoiceId.value = pickedChoiceId.value === choiceId ? null : choiceId
}

const activateSlot = (unitId: string) => {
  if (isCorrect.value) return
  if (pickedChoiceId.value) placeCard(unitId, pickedChoiceId.value)
  else if (placedSlotId.value === unitId) clearPlacement()
}

const slotIdAt = (x: number, y: number): string | null => {
  for (const [unitId, element] of slotElements) {
    const rect = element.getBoundingClientRect()
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return unitId
  }
  return null
}

const beginDrag = (choiceId: string, event: PointerEvent) => {
  if (isCorrect.value || event.button !== 0) return
  event.preventDefault()
  const rect = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect()
  dragSize.value = { width: rect?.width ?? 0, height: rect?.height ?? 0 }
  draggingChoiceId.value = choiceId
  dragStart.value = { x: event.clientX, y: event.clientY }
  dragPoint.value = { x: event.clientX, y: event.clientY }
  hoverSlotId.value = slotIdAt(event.clientX, event.clientY)
}

const onPointerMove = (event: PointerEvent) => {
  if (!draggingChoiceId.value) return
  dragPoint.value = { x: event.clientX, y: event.clientY }
  hoverSlotId.value = slotIdAt(event.clientX, event.clientY)
}

const finishPointerDrag = (event: PointerEvent) => {
  const choiceId = draggingChoiceId.value
  if (!choiceId) return
  const dropSlotId = slotIdAt(event.clientX, event.clientY)
  const moved =
    Math.abs(event.clientX - dragStart.value.x) > 6
    || Math.abs(event.clientY - dragStart.value.y) > 6
  draggingChoiceId.value = null
  hoverSlotId.value = null
  if (dropSlotId && moved) placeCard(dropSlotId, choiceId)
  else if (!moved) pickCard(choiceId)
}

const cancelPointerDrag = () => {
  draggingChoiceId.value = null
  hoverSlotId.value = null
}

const sameSet = (left: string[], right: string[]) =>
  left.length === right.length && left.every((id) => right.includes(id))

const submit = async () => {
  if (!canSubmit.value || isCorrect.value) return

  const submitted = `${placedSlotId.value}:${placedChoiceId.value}`
  const correct =
    sameSet([placedSlotId.value as string], targetIds.value)
    && placedChoiceId.value === props.question.replacementAnswerId

  session.selectAnswer(correct ? props.question.answer : submitted)
  const completed = await session.submitAnswer()
  if (completed) {
    void audio.speak(props.question.targetResult ?? '', 0.8)
  } else {
    // 오답이면 끼운 카드가 알아서 빠져 처음 상태로 돌아간다
    if (session.progressState.attemptCount >= 2 && session.progressState.hintLevel < 2) {
      session.showHint()
    }
    placedSlotId.value = null
    placedChoiceId.value = null
    pickedChoiceId.value = null
  }
}

const isTargetUnit = (unitId: string) => targetIds.value.includes(unitId)
const showPulse = (unitId: string) => session.progressState.hintLevel >= 1 && isTargetUnit(unitId)
const showDirectHint = (unitId: string) => session.progressState.hintLevel >= 2 && isTargetUnit(unitId)

watch(
  () => props.question.id,
  () => {
    placedSlotId.value = null
    placedChoiceId.value = null
    pickedChoiceId.value = null
    draggingChoiceId.value = null
    hoverSlotId.value = null
    void nextTick(playQuestion)
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', finishPointerDrag)
  window.addEventListener('pointercancel', cancelPointerDrag)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', finishPointerDrag)
  window.removeEventListener('pointercancel', cancelPointerDrag)
})
</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <h1>{{ question.instruction }}</h1>

    <div class="play-area">
      <div class="manipulation-panel">
        <!-- 원래 낱말(진한 글자 카드) → 만들 소리(듣기) -->
        <!-- 주의: .task-row는 TrainingLessonView.css가 구조용으로 강제 스타일링하므로 쓰면 안 된다 -->
        <div class="word-goal-row">
          <div class="word-group" :aria-label="`바꿀 낱말 ${question.targetText}`">
            <button
              v-for="soundUnit in units"
              :key="soundUnit.id"
              :ref="(el) => setSlotElement(soundUnit.id, el as HTMLElement | null)"
              class="word-unit"
              :class="{
                'word-unit--replaced': placedSlotId === soundUnit.id,
                'word-unit--droppable': Boolean(draggingChoiceId),
                'word-unit--over': Boolean(draggingChoiceId) && hoverSlotId === soundUnit.id,
                'word-unit--pulse': showPulse(soundUnit.id),
                'word-unit--direct': showDirectHint(soundUnit.id),
              }"
              type="button"
              :aria-label="placedSlotId === soundUnit.id
                ? `${soundUnit.text} 자리에 ${placedText} 카드가 끼워졌어요. 누르면 되돌려요`
                : `${soundUnit.text} 글자. 새 소리 카드를 끌어와 바꿔요`"
              @click="activateSlot(soundUnit.id)"
            >
              <span
                v-if="placedSlotId === soundUnit.id"
                class="slot-card"
                :style="toneStyle(placedChoiceId as string)"
              >{{ placedText }}</span>
              <span v-else class="unit-letter">{{ soundUnit.text }}</span>
            </button>
          </div>

          <svg class="goal-arrow" viewBox="0 0 64 32" aria-hidden="true">
            <path d="M7 16 H45" />
            <path d="M36 7 L48 16 L36 25" />
          </svg>

          <div class="goal-chip">
            <span class="goal-mark" aria-hidden="true">?</span>
            <SoundButton
              :text="question.targetResult ?? ''"
              :rate="0.8"
              size="medium"
              variant="primary"
              label="바꿔서 만들 낱말"
            />
          </div>
        </div>

        <!-- 새 소리 카드 트레이. 끼운 카드 자리는 비워 두되 레이아웃과 색 순환은 유지한다 -->
        <div class="card-tray choices" aria-label="새 소리 카드">
          <button
            v-for="replacement in replacements"
            :key="replacement.id"
            class="replacement-card"
            :class="{
              'replacement-card--used': replacement.id === placedChoiceId,
              'replacement-card--picked': pickedChoiceId === replacement.id,
              'replacement-card--dragging': draggingChoiceId === replacement.id,
              'replacement-card--hint': session.progressState.hintLevel >= 2 && replacement.id === question.replacementAnswerId,
            }"
            type="button"
            :aria-pressed="pickedChoiceId === replacement.id"
            :aria-label="`${replacement.text} 카드. 바꿀 글자 위로 끌어 놓거나, 누른 뒤 글자를 누르세요`"
            @keydown.enter.prevent="pickCard(replacement.id)"
            @keydown.space.prevent="pickCard(replacement.id)"
            @pointerdown="beginDrag(replacement.id, $event)"
          >
            {{ replacement.text }}
          </button>
        </div>
      </div>

      <div class="function-panel">
        <button
          class="complete-button"
          :class="{ 'complete-button--success': isCorrect }"
          type="button"
          :disabled="!canSubmit || isCorrect"
          @click="submit"
        >
          <span>완성!</span>
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="draggingChoiceId"
        class="sound-drag-ghost"
        :style="{
          ...toneStyle(draggingChoiceId),
          left: `${dragPoint.x}px`,
          top: `${dragPoint.y}px`,
          width: dragSize.width ? `${dragSize.width}px` : undefined,
          height: dragSize.height ? `${dragSize.height}px` : undefined,
        }"
        aria-hidden="true"
      ><span class="ghost-letter">{{ ghostText }}</span></div>
    </Teleport>

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

<style scoped src="@/styles/training/activities/SoundManipulationActivity.css"></style>
