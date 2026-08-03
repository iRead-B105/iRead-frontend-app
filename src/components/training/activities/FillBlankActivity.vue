<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { TrainingChoice, TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

interface SpeechResultEvent extends Event {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}
interface SpeechErrorEvent extends Event { error?: string }
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: ((event: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike
type SpeechState = 'waiting' | 'listening' | 'retry' | 'success' | 'denied'

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
const speechState = ref<SpeechState>('waiting')
const speechMessage = ref('')
let recognition: SpeechRecognitionLike | null = null
let wrongTimer: ReturnType<typeof setTimeout> | null = null
let speechRetryTimer: ReturnType<typeof setTimeout> | null = null

const isFilled = computed(() => placedChoice.value?.id === props.question.answer)
const showHint = computed(() => attempts.value >= 2 && !isFilled.value)
const isComplete = computed(() => speechState.value === 'success')

const normalize = (value: string) => value.replace(/[\s.,!?~'"’“”]/g, '').toLowerCase()

const sentenceMatches = (transcript: string) => {
  const heard = normalize(transcript)
  const answer = normalize(completedSentence.value)
  return Boolean(answer && (heard === answer || heard.includes(answer)))
}

const finishSpeech = () => {
  if (isComplete.value) return
  speechState.value = 'success'
  speechMessage.value = '다 읽었어!'
  session.markRecordingComplete({ isMock: false, audioUrl: null })
}

const handleTranscript = (transcript: string) => {
  if (!isFilled.value || speechState.value !== 'listening') return
  if (sentenceMatches(transcript)) finishSpeech()
  else {
    speechState.value = 'retry'
    speechMessage.value = '한 번 더 읽어봐!'
    speechRetryTimer = setTimeout(startSpeech, 900)
  }
}

const startSpeech = () => {
  if (!isFilled.value || speechState.value === 'listening' || isComplete.value) return
  speechState.value = 'listening'
  speechMessage.value = '문장을 읽어봐!'

  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
  if (!Recognition) return

  recognition?.stop()
  recognition = new Recognition()
  recognition.lang = 'ko-KR'
  recognition.interimResults = false
  recognition.continuous = false
  recognition.onresult = (event) => handleTranscript(event.results[0]?.[0]?.transcript ?? '')
  recognition.onerror = (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
      window.dispatchEvent(new CustomEvent('iread:microphone-state', { detail: { active: false, available: false } }))
      speechState.value = 'denied'
      speechMessage.value = '마이크를 켜고 다시 눌러요'
      return
    }
    if (event.error !== 'aborted') {
      speechState.value = 'retry'
      speechMessage.value = '한 번 더 읽어봐!'
      speechRetryTimer = setTimeout(startSpeech, 900)
    }
  }
  recognition.onend = () => {
    if (speechState.value === 'listening') {
      speechState.value = 'retry'
      speechMessage.value = '한 번 더 읽어봐!'
      speechRetryTimer = setTimeout(startSpeech, 900)
    }
    recognition = null
  }
  recognition.start()
}

watch(isFilled, (filled) => {
  if (!filled) return
  if (speechRetryTimer) clearTimeout(speechRetryTimer)
  speechRetryTimer = setTimeout(startSpeech, 450)
})

const evaluateChoice = (choiceId: string) => {
  if (isFilled.value) return
  const choice = choices.value.find((item) => item.id === choiceId)
  if (!choice) return

  if (choice.id === props.question.answer) {
    placedChoice.value = choice
    wrongChoiceId.value = null
    speechState.value = 'waiting'
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
const onExternalSpeech = (event: Event) => {
  const detail = (event as CustomEvent<{ transcript?: string }>).detail
  if (detail?.transcript) handleTranscript(detail.transcript)
}

onMounted(() => {
  window.addEventListener('iread:speech', onExternalSpeech)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', finishPointerDrag)
  window.addEventListener('pointercancel', cancelPointerDrag)
})
onBeforeUnmount(() => {
  window.removeEventListener('iread:speech', onExternalSpeech)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', finishPointerDrag)
  window.removeEventListener('pointercancel', cancelPointerDrag)
  recognition?.stop()
  if (wrongTimer) clearTimeout(wrongTimer)
  if (speechRetryTimer) clearTimeout(speechRetryTimer)
})
</script>

<template>
  <section class="activity activity--fill-blank" :aria-label="question.instruction">
    <header class="activity-heading">
      <h1>{{ isFilled ? '완성한 문장을 읽어봐!' : '빈칸에 낱말을 넣어봐!' }}</h1>
      <p v-if="speechMessage" class="status-message" :class="speechState" role="status" aria-live="polite">
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
