<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { TrainingChoice, TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

const session = useTrainingSession()
const slotsElement = ref<HTMLElement | null>(null)
const choices = computed<TrainingChoice[]>(() => props.question.choices ?? [])
const correctOrder = computed(() => props.question.answer.split('|'))
const slots = ref<(string | null)[]>([])
const attempts = ref(0)
const wrongIndices = ref<number[]>([])
const assemblyCorrect = ref(false)
const statusMessage = ref('')
const draggingChoiceId = ref<string | null>(null)
const draggingFromSlot = ref<number | null>(null)
const dragPoint = ref({ x: 0, y: 0 })
// 고스트가 원본 카드와 같은 크기·글자 모양을 유지하도록 드래그 시작 시 기억한다.
const dragSize = ref({ width: 0, height: 0 })
const dragTextStyle = ref<Record<string, string>>({})
const overSlotIndex = ref<number | null>(null)
let wrongTimer: ReturnType<typeof setTimeout> | null = null

const placed = computed(() => slots.value.map((id) => choices.value.find((choice) => choice.id === id) ?? null))
const remaining = computed(() => choices.value.filter((choice) => !slots.value.includes(choice.id)))
// 카드마다 색을 고정한다(원래 제시 순서 기준 3색 순환).
// 소스 줄 → 드래그 → 슬롯 장착까지 같은 카드는 항상 같은 색을 유지한다.
// 색상은 공통 낱말 카드 PNG(choice-card-word-*)에서 추출한 값.
const CARD_TONES = ['yellow', 'mint', 'purple'] as const
const TONE_COLORS = {
  yellow: { border: '#fde995', dash: '#f0d072' },
  mint: { border: '#a8ead8', dash: '#8fdfc8' },
  purple: { border: '#bfa8ea', dash: '#b296e6' },
} as const
const toneOf = (choiceId: string) => {
  const index = choices.value.findIndex((choice) => choice.id === choiceId)
  return CARD_TONES[Math.max(index, 0) % 3]!
}
const toneStyle = (choiceId: string) => {
  const tone = TONE_COLORS[toneOf(choiceId)]
  return { '--word-frame-border': tone.border, '--word-frame-dash': tone.dash }
}
const dragTone = computed(() =>
  draggingChoiceId.value ? toneOf(draggingChoiceId.value) : null,
)
const allFilled = computed(() => slots.value.length > 0 && slots.value.every(Boolean))
const isComplete = computed(() => session.progressState.isCurrentCorrect === true)
const nextEmptyIndex = computed(() => slots.value.findIndex((value) => value === null))
const hintChoiceId = computed(() => {
  if (attempts.value < 2 || assemblyCorrect.value) return null
  const emptyIndex = nextEmptyIndex.value
  return emptyIndex >= 0 ? correctOrder.value[emptyIndex] ?? null : null
})

const reset = () => {
  slots.value = Array.from({ length: choices.value.length }, () => null)
  attempts.value = 0
  wrongIndices.value = []
  assemblyCorrect.value = false
  statusMessage.value = ''
  draggingChoiceId.value = null
  draggingFromSlot.value = null
  overSlotIndex.value = null
  if (wrongTimer) clearTimeout(wrongTimer)
}
watch(() => props.question.id, reset, { immediate: true })

const normalize = (value: string) => value.replace(/[\s.,!?~'"’“”]/g, '').toLowerCase()
const sentenceMatches = (transcript: string) => {
  const heard = normalize(transcript)
  const answer = normalize(props.question.targetText ?? '')
  return Boolean(answer && (heard === answer || heard.includes(answer)))
}

// 조립이 맞으면 낭독 단계 없이 바로 답안을 제출해 문항을 완료한다.
// 단어 시도 로그는 백엔드가 답안 완료 시점에 만들어 시선 병합과 연결된다.
const submitAssembly = async () => {
  if (isComplete.value) return
  session.selectAnswer(props.question.answer)
  const completed = await session.submitAnswer()
  if (completed) statusMessage.value = '잘 만들었어!'
}

watch(assemblyCorrect, (correct) => {
  if (correct) void submitAssembly()
})

const evaluateSentence = () => {
  if (!allFilled.value || assemblyCorrect.value) return
  const wrong = slots.value
    .map((id, index) => id === correctOrder.value[index] ? -1 : index)
    .filter((index) => index >= 0)

  if (wrong.length === 0) {
    assemblyCorrect.value = true
    statusMessage.value = ''
    return
  }

  attempts.value += 1
  wrongIndices.value = wrong
  statusMessage.value = '한 번 더 해봐!'
  if (wrongTimer) clearTimeout(wrongTimer)
  wrongTimer = setTimeout(() => {
    const next = [...slots.value]
    wrong.forEach((index) => { next[index] = null })
    slots.value = next
    wrongIndices.value = []
  }, 700)
}

const slotIndexAt = (clientX: number, clientY: number) => {
  const slotNodes = slotsElement.value?.querySelectorAll<HTMLElement>('.sentence-slot')
  if (!slotNodes) return null
  for (let index = 0; index < slotNodes.length; index += 1) {
    const rect = slotNodes[index]?.getBoundingClientRect()
    if (rect && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) return index
  }
  return null
}
const startPointerDrag = (event: PointerEvent, choiceId: string, fromSlot: number | null) => {
  if (assemblyCorrect.value || event.button !== 0 || wrongIndices.value.length > 0) return
  event.preventDefault()
  const card = event.currentTarget as HTMLElement | null
  const rect = card?.getBoundingClientRect()
  dragSize.value = { width: rect?.width ?? 0, height: rect?.height ?? 0 }
  const textElement = card?.querySelector('strong') ?? card
  if (textElement) {
    const computed = window.getComputedStyle(textElement)
    dragTextStyle.value = {
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      fontFamily: computed.fontFamily,
      letterSpacing: computed.letterSpacing,
      color: computed.color,
    }
  } else {
    dragTextStyle.value = {}
  }
  draggingChoiceId.value = choiceId
  draggingFromSlot.value = fromSlot
  dragPoint.value = { x: event.clientX, y: event.clientY }
  overSlotIndex.value = slotIndexAt(event.clientX, event.clientY)
}
const onPointerMove = (event: PointerEvent) => {
  if (!draggingChoiceId.value) return
  dragPoint.value = { x: event.clientX, y: event.clientY }
  overSlotIndex.value = slotIndexAt(event.clientX, event.clientY)
}
const finishPointerDrag = (event: PointerEvent) => {
  const choiceId = draggingChoiceId.value
  const origin = draggingFromSlot.value
  if (!choiceId) return
  const target = slotIndexAt(event.clientX, event.clientY)
  draggingChoiceId.value = null
  draggingFromSlot.value = null
  overSlotIndex.value = null

  const next = [...slots.value]
  if (target === null) {
    if (origin !== null) next[origin] = null
  } else if (origin === null) {
    next[target] = choiceId
  } else if (target !== origin) {
    const displaced = next[target] ?? null
    next[target] = choiceId
    next[origin] = displaced
  }
  slots.value = next
  void nextTick(evaluateSentence)
}
const cancelPointerDrag = () => {
  draggingChoiceId.value = null
  draggingFromSlot.value = null
  overSlotIndex.value = null
}
onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', finishPointerDrag)
  window.addEventListener('pointercancel', cancelPointerDrag)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', finishPointerDrag)
  window.removeEventListener('pointercancel', cancelPointerDrag)
  if (wrongTimer) clearTimeout(wrongTimer)
})
</script>

<template>
  <section class="activity activity--sentence-order" :aria-label="question.instruction">
    <header class="activity-heading">
      <h1>문장을 만들어봐!</h1>
      <p v-if="statusMessage" class="status-message" role="status" aria-live="polite">{{ statusMessage }}</p>
    </header>

    <div ref="slotsElement" class="slots" :style="{ '--slot-count': slots.length }">
      <div
        v-for="(choice, index) in placed"
        :key="index"
        class="sentence-slot"
        :class="{
          filled: choice,
          correct: assemblyCorrect,
          wrong: wrongIndices.includes(index),
          over: overSlotIndex === index,
          hint: hintChoiceId && nextEmptyIndex === index,
        }"
      >
        <span
          v-if="choice"
          class="placed-card"
          :class="{ dragging: draggingChoiceId === choice.id && draggingFromSlot === index }"
          :style="toneStyle(choice.id)"
          @pointerdown="startPointerDrag($event, choice.id, index)"
        >{{ choice.text }}</span>
      </div>
    </div>

    <div class="source-cards choices" :style="{ '--card-count': slots.length }" aria-label="문장 카드">
      <article
        v-for="choice in remaining"
        :key="choice.id"
        class="word-card"
        :class="{
          hint: hintChoiceId === choice.id,
          dragging: draggingChoiceId === choice.id && draggingFromSlot === null,
        }"
        :style="toneStyle(choice.id)"
        @pointerdown="startPointerDrag($event, choice.id, null)"
      >
        <strong>{{ choice.text }}</strong>
      </article>
    </div>

    <Teleport to="body">
      <div
        v-if="draggingChoiceId"
        class="drag-ghost"
        :class="dragTone ? 'drag-ghost--card' : 'drag-ghost--chip'"
        :style="{
          ...(draggingChoiceId ? toneStyle(draggingChoiceId) : {}),
          left: `${dragPoint.x}px`,
          top: `${dragPoint.y}px`,
          width: dragSize.width ? `${dragSize.width}px` : undefined,
          height: dragSize.height ? `${dragSize.height}px` : undefined,
          ...dragTextStyle,
        }"
        aria-hidden="true"
      >{{ choices.find((choice) => choice.id === draggingChoiceId)?.text }}</div>
    </Teleport>

    <footer class="action-bar">
      <button v-if="isComplete" class="next-button shared-next-source" type="button" @click="$emit('next')">다음</button>
    </footer>
  </section>
</template>

<style scoped src="@/styles/training/activities/SentenceOrderActivity.css"></style>
