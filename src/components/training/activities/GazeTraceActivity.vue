<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { TracePoint, TrainingQuestion } from '@/types/training'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useTrainingSession } from '@/composables/useTrainingSession'
import type { LearnerTraceSubmissionResponse } from '@/features/learner/training'
import SoundButton from '../SoundButton.vue'

const props = defineProps<{ question: TrainingQuestion }>()
const emit = defineEmits<{ next: [response: LearnerTraceSubmissionResponse] }>()

const session = useTrainingSession()
const { replay, isPlaying } = useAudioPlayer()
const stage = ref<SVGSVGElement | null>(null)
const progress = ref(0)
const cursor = ref({ x: 0, y: 0 })
const cursorVisible = ref(false)
const stalled = ref(false)
const speechState = ref<'waiting' | 'listening' | 'retry' | 'success'>('waiting')
const speechMessage = ref('')
const recordedStrokes = ref<Array<Array<{
  x: number
  y: number
  elapsedMs: number
  pressure?: number
}>>>([])
let lastAdvanceAt = 0
let traceStartedAt = 0
let stallTimer: ReturnType<typeof setInterval> | null = null
let recognition: SpeechRecognitionLike | null = null
let fallbackTimer: ReturnType<typeof setTimeout> | null = null

interface SpeechRecognitionResultEventLike extends Event {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}

interface SpeechRecognitionErrorEventLike extends Event { error?: string }

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

const strokes = computed(() => props.question.traceStrokes ?? [])
const flatPoints = computed(() => strokes.value.flat())
const totalPoints = computed(() => flatPoints.value.length)
const traceCompleted = computed(() => totalPoints.value > 0 && progress.value >= totalPoints.value)
const currentPoint = computed<TracePoint | null>(() => flatPoints.value[progress.value] ?? null)
const glyphText = computed(() => props.question.traceGlyph ?? props.question.targetText ?? '')

const pointString = (points: TracePoint[]) => points.map((point) => `${point.x},${point.y}`).join(' ')

const strokeIndexAt = (pointIndex: number): number => {
  let offset = pointIndex
  for (let index = 0; index < strokes.value.length; index += 1) {
    const length = strokes.value[index]?.length ?? 0
    if (offset < length) return index
    offset -= length
  }
  return Math.max(strokes.value.length - 1, 0)
}

const completedStroke = (strokeIndex: number): TracePoint[] => {
  const before = strokes.value.slice(0, strokeIndex).reduce((sum, stroke) => sum + stroke.length, 0)
  const count = Math.min(Math.max(progress.value - before, 0), strokes.value[strokeIndex]?.length ?? 0)
  return strokes.value[strokeIndex]?.slice(0, count) ?? []
}

const normalizeSpeech = (value: string) => value.replace(/[\s.,!?]/g, '').toLowerCase()

const finishSpeech = (isMock: boolean) => {
  if (speechState.value === 'success') return
  speechState.value = 'success'
  speechMessage.value = '목소리를 잘 들었어요!'
  session.markRecordingComplete({ isMock, audioUrl: null })
}

const speechMatches = (transcript: string) => {
  const heard = normalizeSpeech(transcript)
  const accepted = [props.question.traceGlyph ?? '', ...(props.question.speechAliases ?? [])]
    .map(normalizeSpeech)
    .filter(Boolean)
  return accepted.some((answer) => heard === answer || heard.includes(answer))
}

const startSpeech = () => {
  if (!traceCompleted.value || speechState.value === 'listening' || speechState.value === 'success') return
  speechState.value = 'listening'
  speechMessage.value = '말해 보세요!'

  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition

  if (!Recognition) {
    fallbackTimer = setTimeout(() => finishSpeech(true), 1200)
    return
  }

  recognition = new Recognition()
  recognition.lang = 'ko-KR'
  recognition.interimResults = false
  recognition.continuous = false
  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript ?? ''
    if (speechMatches(transcript)) finishSpeech(false)
    else {
      speechState.value = 'retry'
      speechMessage.value = `${props.question.traceGlyph} 소리를 다시 말해봐요.`
    }
  }
  recognition.onerror = () => {
    speechState.value = 'retry'
    speechMessage.value = '마이크를 켜고 다시 말해봐요.'
  }
  recognition.onend = () => {
    if (speechState.value === 'listening') {
      speechState.value = 'retry'
      speechMessage.value = '한 번 더 또박또박 말해봐요.'
    }
    recognition = null
  }
  recognition.start()
}

const speakGlyph = () => {
  const glyph = props.question.traceGlyph ?? props.question.targetText
  if (glyph && !isPlaying.value) void replay(glyph, 0.68)
}

const announceRepeat = async () => {
  const glyph = props.question.traceGlyph ?? ''
  await replay(`따라 해봐. ${glyph}`, 0.72)
}

const advanceFromClientPoint = (clientX: number, clientY: number) => {
  const svg = stage.value
  const target = currentPoint.value
  if (!svg || !target || traceCompleted.value) return

  const screenMatrix = svg.getScreenCTM()
  if (!screenMatrix) return
  const localPoint = new DOMPoint(clientX, clientY).matrixTransform(screenMatrix.inverse())
  const x = localPoint.x
  const y = localPoint.y
  cursor.value = { x, y }
  cursorVisible.value = x >= 0 && x <= 640 && y >= 0 && y <= 500

  const distance = Math.hypot(x - target.x, y - target.y)
  if (distance <= 46) {
    if (traceStartedAt === 0) traceStartedAt = Date.now()
    const strokeIndex = strokeIndexAt(progress.value)
    const points = recordedStrokes.value[strokeIndex] ?? []
    if (!recordedStrokes.value[strokeIndex]) recordedStrokes.value[strokeIndex] = points
    points.push({
      x: Math.max(0, x),
      y: Math.max(0, y),
      elapsedMs: Date.now() - traceStartedAt,
    })
    progress.value += 1
    lastAdvanceAt = Date.now()
    stalled.value = false
  }
}

const onPointerMove = (event: PointerEvent) => advanceFromClientPoint(event.clientX, event.clientY)
const onPointerLeave = () => { cursorVisible.value = false }
const onGaze = (event: Event) => {
  const detail = (event as CustomEvent<{ clientX?: number; clientY?: number; headPoseStable?: boolean }>).detail
  if (
    detail?.headPoseStable !== false
    && typeof detail?.clientX === 'number'
    && typeof detail?.clientY === 'number'
  ) advanceFromClientPoint(detail.clientX, detail.clientY)
}

const submitTrace = () => {
  const strokes = recordedStrokes.value
    .filter((points) => points.length >= 2)
    .map((points) => ({ points: points.map((point) => ({ ...point })) }))
  if (strokes.length === 0) return
  emit('next', {
    canvasWidth: 640,
    canvasHeight: 500,
    strokes,
  })
}

const resetQuestion = () => {
  progress.value = 0
  cursorVisible.value = false
  stalled.value = false
  speechState.value = 'waiting'
  speechMessage.value = ''
  recordedStrokes.value = []
  lastAdvanceAt = 0
  traceStartedAt = 0
  recognition?.stop()
  recognition = null
  if (fallbackTimer) clearTimeout(fallbackTimer)
  fallbackTimer = null
  void nextTick(speakGlyph)
}

watch(() => props.question.id, resetQuestion, { immediate: true })
watch(traceCompleted, (completed, wasCompleted) => {
  if (completed && !wasCompleted) void announceRepeat()
})

onMounted(() => {
  window.addEventListener('iread:gaze', onGaze)
  stallTimer = setInterval(() => {
    if (progress.value > 0 && !traceCompleted.value && lastAdvanceAt && Date.now() - lastAdvanceAt >= 3000) {
      stalled.value = true
    }
  }, 250)
})

onBeforeUnmount(() => {
  window.removeEventListener('iread:gaze', onGaze)
  if (stallTimer) clearInterval(stallTimer)
  if (fallbackTimer) clearTimeout(fallbackTimer)
  recognition?.stop()
})
</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <header class="activity-heading">
      <h1>{{ traceCompleted ? `${question.traceGlyph} 완성!` : question.instruction }}</h1>
      <SoundButton :text="glyphText" size="medium" variant="primary" />
    </header>

    <div class="trace-layout">
      <div
        class="trace-stage"
        :class="{ complete: traceCompleted }"
        @pointermove="onPointerMove"
        @pointerdown="onPointerMove"
        @pointerleave="onPointerLeave"
      >
        <svg
          ref="stage"
          class="trace-svg"
          viewBox="0 0 640 500"
          role="img"
          :aria-label="`${question.traceGlyph} 획순 따라 보기`"
        >
          <g v-for="(stroke, strokeIndex) in strokes" :key="`base-${strokeIndex}`">
            <polyline class="stroke-outline" :points="pointString(stroke)" />
            <polyline class="stroke-guide" :points="pointString(stroke)" />
            <polyline v-if="completedStroke(strokeIndex).length > 1" class="stroke-filled" :points="pointString(completedStroke(strokeIndex))" />
          </g>
          <circle v-if="currentPoint" class="resume-point" :class="{ stalled }" :cx="currentPoint.x" :cy="currentPoint.y" r="21" />
          <circle v-if="traceCompleted" class="complete-ring" cx="320" cy="250" r="205" />
        </svg>
        <p v-if="stalled" class="resume-message" role="status">반짝이는 곳부터 다시 봐요!</p>
      </div>

      <aside class="speech-panel" :class="{ active: traceCompleted }">
        <template v-if="!traceCompleted">
          <span class="eye-icon" aria-hidden="true">◉</span>
          <strong>글자를 따라가봐요</strong>
        </template>
        <template v-else>
          <span class="speech-glyph" aria-hidden="true">{{ question.traceGlyph }}</span>
          <strong>따라 말해봐요</strong>
          <button v-if="speechState !== 'success'" class="mic-button" type="button" :disabled="speechState === 'listening'" @click="startSpeech">
            <span aria-hidden="true">●</span>
            {{ speechState === 'listening' ? '듣고 있어요' : '말하기' }}
          </button>
          <p v-if="speechMessage" class="speech-message" role="status">{{ speechMessage }}</p>
        </template>
      </aside>
    </div>

    <div class="action-bar">
      <button v-if="speechState === 'success'" class="next-button" type="button" @click="submitTrace">다음 문제</button>
    </div>
  </section>
</template>

<style scoped src="@/styles/training/activities/GazeTraceActivity.css"></style>
