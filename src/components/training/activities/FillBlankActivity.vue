<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { TrainingChoice, TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

const session = useTrainingSession()
const choices = computed<TrainingChoice[]>(() => props.question.choices ?? [])
const sentenceParts = computed(() => (props.question.targetText ?? '').split(/___|\{\{blank\}\}/))
const correctChoice = computed(() => choices.value.find((choice) => choice.id === props.question.answer) ?? null)
const completedSentence = computed(() =>
  (props.question.targetText ?? '').replace(/___|\{\{blank\}\}/, correctChoice.value?.text ?? ''),
)

const placedChoice = ref<TrainingChoice | null>(null)
const blankElement = ref<HTMLElement | null>(null)
const attempts = ref(0)
const wrongChoiceId = ref<string | null>(null)
const isOverBlank = ref(false)
const draggingChoiceId = ref<string | null>(null)
const dragPoint = ref({ x: 0, y: 0 })
// 고스트가 원본 카드와 같은 크기·글자 모양을 유지하도록 드래그 시작 시 기억한다.
const dragSize = ref({ width: 0, height: 0 })
const dragTextStyle = ref<Record<string, string>>({})

// 카드마다 색을 고정한다(제시 순서 기준 3색 순환).
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
const speechMessage = ref('')
let wrongTimer: ReturnType<typeof setTimeout> | null = null

const isFilled = computed(() => placedChoice.value?.id === props.question.answer)
const showHint = computed(() => attempts.value >= 2 && !isFilled.value)
const isComplete = computed(() => session.progressState.isCurrentCorrect === true)

const normalize = (value: string) => value.replace(/[\s.,!?~'"’“”]/g, '').toLowerCase()

const sentenceMatches = (transcript: string) => {
  const heard = normalize(transcript)
  const answer = normalize(completedSentence.value)
  return Boolean(answer && (heard === answer || heard.includes(answer)))
}

// 정답 카드를 채우면 낭독 단계 없이 바로 답안을 제출해 문항을 완료한다.
// 단어 시도 로그는 백엔드가 답안 완료 시점에 만들어 시선 병합과 연결된다.
const submitFilledAnswer = async () => {
  if (isComplete.value) return
  session.selectAnswer(props.question.answer)
  const completed = await session.submitAnswer()
  if (completed) speechMessage.value = '잘 골랐어!'
}

watch(isFilled, (filled) => {
  if (filled) void submitFilledAnswer()
})

const evaluateChoice = (choiceId: string) => {
  if (isFilled.value) return
  const choice = choices.value.find((item) => item.id === choiceId)
  if (!choice) return

  if (choice.id === props.question.answer) {
    placedChoice.value = choice
    wrongChoiceId.value = null
    speechMessage.value = ''
    return
  }

  attempts.value += 1
  wrongChoiceId.value = choice.id
  speechMessage.value = '한 번 더 해봐!'
  if (wrongTimer) clearTimeout(wrongTimer)
  wrongTimer = setTimeout(() => {
    wrongChoiceId.value = null
  }, 650)
}

const pointIsOverBlank = (clientX: number, clientY: number) => {
  const rect = blankElement.value?.getBoundingClientRect()
  return Boolean(rect && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom)
}
const startPointerDrag = (event: PointerEvent, choice: TrainingChoice) => {
  if (isFilled.value || event.button !== 0) return
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
  draggingChoiceId.value = choice.id
  dragPoint.value = { x: event.clientX, y: event.clientY }
  isOverBlank.value = pointIsOverBlank(event.clientX, event.clientY)
}
const onPointerMove = (event: PointerEvent) => {
  if (!draggingChoiceId.value) return
  dragPoint.value = { x: event.clientX, y: event.clientY }
  isOverBlank.value = pointIsOverBlank(event.clientX, event.clientY)
}
const finishPointerDrag = (event: PointerEvent) => {
  const choiceId = draggingChoiceId.value
  if (!choiceId) return
  const shouldDrop = pointIsOverBlank(event.clientX, event.clientY)
  draggingChoiceId.value = null
  isOverBlank.value = false
  if (shouldDrop) evaluateChoice(choiceId)
}
const cancelPointerDrag = () => {
  draggingChoiceId.value = null
  isOverBlank.value = false
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
  <section class="activity activity--fill-blank" :aria-label="question.instruction">
    <header class="activity-heading">
      <h1>빈칸에 낱말을 넣어봐!</h1>
      <p v-if="speechMessage" class="status-message" role="status" aria-live="polite">
        {{ speechMessage }}
      </p>
    </header>

    <div class="sentence-card" aria-live="polite">
      <span>{{ sentenceParts[0] }}</span>
      <span
        ref="blankElement"
        class="blank"
        :class="{ filled: isFilled, over: isOverBlank, hint: showHint }"
        :style="placedChoice ? toneStyle(placedChoice.id) : undefined"
      >
        {{ placedChoice?.text ?? '' }}
      </span>
      <span>{{ sentenceParts[1] }}</span>
    </div>

    <div class="choices" :class="{ locked: isFilled }">
      <article
        v-for="choice in choices"
        :key="choice.id"
        class="word-card"
        :class="{
          wrong: wrongChoiceId === choice.id,
          hint: showHint && choice.id === question.answer,
          used: placedChoice?.id === choice.id,
          dragging: draggingChoiceId === choice.id,
        }"
        :style="toneStyle(choice.id)"
        @pointerdown="startPointerDrag($event, choice)"
      >
        <strong>{{ choice.text }}</strong>
      </article>
    </div>

    <Teleport to="body">
      <div
        v-if="draggingChoiceId"
        class="drag-ghost"
        :style="{
          ...toneStyle(draggingChoiceId),
          left: `${dragPoint.x}px`,
          top: `${dragPoint.y}px`,
          width: dragSize.width ? `${dragSize.width}px` : undefined,
          height: dragSize.height ? `${dragSize.height}px` : undefined,
          ...dragTextStyle,
        }"
        aria-hidden="true"
      >
        {{ choices.find((choice) => choice.id === draggingChoiceId)?.text }}
      </div>
    </Teleport>

    <footer class="action-bar">
      <button v-if="isComplete" class="next-button shared-next-source" type="button" @click="$emit('next')">다음</button>
    </footer>
  </section>
</template>

<style scoped src="@/styles/training/activities/FillBlankActivity.css"></style>
