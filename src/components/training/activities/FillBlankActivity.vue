<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { TrainingChoice, TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import { readingRecordingMs } from '@/lib/readingRecordingDuration'

const props = defineProps<{ question: TrainingQuestion }>()
type VoiceEvaluationControls = {
  success: (message?: string) => void
  retry: (message?: string) => void
}
const emit = defineEmits<{
  next: []
  voiceRecorded: [blob: Blob, controls: VoiceEvaluationControls]
}>()

type SpeechState = 'waiting' | 'listening' | 'evaluating' | 'retry' | 'success' | 'denied'

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
const recorder = useVoiceRecorder()
let wrongTimer: ReturnType<typeof setTimeout> | null = null
let speechRetryTimer: ReturnType<typeof setTimeout> | null = null
let autoStopTimer: ReturnType<typeof setTimeout> | null = null
let submittedBlob: Blob | null = null

const isFilled = computed(() => placedChoice.value?.id === props.question.answer)
const showHint = computed(() => attempts.value >= 2 && !isFilled.value)
const isComplete = computed(() => speechState.value === 'success')

// 녹음 최대 시간 = 글자 수 × 1초(3~30초). 끝나면 자동으로 평가로 넘어간다.
const recordingMs = computed(() => readingRecordingMs(completedSentence.value))

const stopAutoTimer = () => {
  if (autoStopTimer) clearTimeout(autoStopTimer)
  autoStopTimer = null
}

const finishSpeech = (message = '다 읽었어!') => {
  if (isComplete.value) return
  speechState.value = 'success'
  speechMessage.value = message
  session.markRecordingComplete({
    audioUrl: recorder.audioUrl.value,
    blob: recorder.audioBlob.value,
  })
}

const retrySpeech = (message = '한 번 더 읽어봐!') => {
  if (isComplete.value) return
  recorder.reset()
  speechState.value = 'retry'
  speechMessage.value = message
  if (speechRetryTimer) clearTimeout(speechRetryTimer)
  speechRetryTimer = setTimeout(() => void startSpeech(), 1_100)
}

// 완성한 문장을 실제로 녹음해 백엔드 발음 평가로 보낸다(부모 evaluateActivityVoice).
const startSpeech = async () => {
  if (!isFilled.value || isComplete.value) return
  if (
    recorder.state.status === 'recording'
    || recorder.state.status === 'requesting'
    || speechState.value === 'evaluating'
  ) return
  recorder.reset()
  submittedBlob = null
  speechState.value = 'listening'
  speechMessage.value = '문장을 읽어봐!'
  await recorder.start()
  if ((recorder.state.status as string) !== 'recording') {
    speechState.value = 'denied'
    speechMessage.value = recorder.state.errorMessage ?? '마이크를 켜고 다시 눌러요'
    return
  }
  stopAutoTimer()
  autoStopTimer = setTimeout(() => recorder.stop(), recordingMs.value)
}

watch(() => recorder.state.status, (status) => {
  // 권한을 다시 허용하면 남아 있던 거부 안내를 걷어내고 다시 시도할 수 있게 한다.
  if (speechState.value === 'denied' && status !== 'denied') {
    speechMessage.value = ''
    speechState.value = 'waiting'
  }
  const blob = recorder.audioBlob.value
  if (status !== 'recorded' || !blob || blob === submittedBlob) return
  stopAutoTimer()
  submittedBlob = blob
  speechState.value = 'evaluating'
  speechMessage.value = '확인 중이에요!'
  emit('voiceRecorded', blob, {
    success: (message) => finishSpeech(message),
    retry: (message) => retrySpeech(message),
  })
})

watch(isFilled, (filled) => {
  if (!filled) return
  if (speechRetryTimer) clearTimeout(speechRetryTimer)
  speechRetryTimer = setTimeout(() => void startSpeech(), 450)
})

const evaluateChoice = (choiceId: string) => {
  if (placedChoice.value || isComplete.value) return
  const choice = choices.value.find((item) => item.id === choiceId)
  if (!choice) return

  if (choice.id === props.question.answer) {
    placedChoice.value = choice
    wrongChoiceId.value = null
    speechState.value = 'waiting'
    speechMessage.value = ''
    // 채운 답을 세션 제출 경로로 저장해 백엔드에 응답 기록을 남긴다.
    session.selectAnswer(choice.id)
    void session.submitAnswer()
    if (session.assessmentMode.value) {
      // 검사는 따라 읽기 없이 바로 다음으로 진행한다.
      speechState.value = 'success'
      speechMessage.value = '다 채웠어!'
    }
    return
  }

  if (session.assessmentMode.value) {
    // 검사는 틀린 선택도 그대로 기록하고 재시도 없이 다음으로 진행한다.
    placedChoice.value = choice
    wrongChoiceId.value = null
    session.selectAnswer(choice.id)
    void session.submitAnswer()
    speechState.value = 'success'
    speechMessage.value = '기록했어! 다음으로 가자'
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
  if (placedChoice.value || isComplete.value || event.button !== 0) return
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
  stopAutoTimer()
  recorder.stop()
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
      <button
        v-if="speechState === 'denied'"
        class="next-button"
        type="button"
        @click="startSpeech"
      >
        말하기
      </button>
      <button v-if="isComplete" class="next-button shared-next-source" type="button" @click="$emit('next')">다음</button>
    </footer>
  </section>
</template>

<style scoped src="@/styles/training/activities/FillBlankActivity.css"></style>
