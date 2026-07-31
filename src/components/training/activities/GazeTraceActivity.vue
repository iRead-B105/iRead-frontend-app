<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { TracePoint, TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import SoundButton from '@/components/training/SoundButton.vue'
import microphoneIcon from '@/assets/icons/microphone.svg'
import { mockDeviceSubmissionsEnabled } from '@/features/learner/training/mockDeviceSubmissions'
import type { LearnerTraceSubmissionResponse } from '@/features/learner/training'

const props = defineProps<{ question: TrainingQuestion }>()
const emit = defineEmits<{
  next: [response: LearnerTraceSubmissionResponse]
  guideMessage: [message: string]
}>()

interface SpeechRecognitionResultEventLike extends Event {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}

interface SpeechRecognitionErrorEventLike extends Event {
  error?: string
}

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
type SpeechState = 'waiting' | 'listening' | 'retry' | 'success'

const session = useTrainingSession()
const audio = useAudioPlayer()
const stage = ref<SVGSVGElement | null>(null)
const progress = ref(0)
const speechState = ref<SpeechState>('waiting')
const recordedStrokes = ref<Array<Array<{
  x: number
  y: number
  elapsedMs: number
  pressure?: number
}>>>([])
let traceStartedAt = 0
let recognition: SpeechRecognitionLike | null = null
let fallbackTimer: ReturnType<typeof setTimeout> | null = null

const strokes = computed(() => props.question.traceStrokes ?? [])
const flatPoints = computed(() => strokes.value.flat())
const totalPoints = computed(() => flatPoints.value.length)
const traceCompleted = computed(() => totalPoints.value > 0 && progress.value >= totalPoints.value)
const currentPoint = computed<TracePoint | null>(() => flatPoints.value[progress.value] ?? null)
const hangulPronunciations: Record<string, string> = {
  'ㄱ': '기역',
  'ㄴ': '니은',
  'ㄷ': '디귿',
  'ㄹ': '리을',
  'ㅁ': '미음',
  'ㅂ': '비읍',
  'ㅅ': '시옷',
  'ㅇ': '이응',
  'ㅈ': '지읒',
  'ㅊ': '치읓',
  'ㅋ': '키읔',
  'ㅌ': '티읕',
  'ㅍ': '피읖',
  'ㅎ': '히읗',
  'ㅏ': '아',
  'ㅑ': '야',
  'ㅓ': '어',
  'ㅕ': '여',
  'ㅗ': '오',
  'ㅛ': '요',
  'ㅜ': '우',
  'ㅠ': '유',
  'ㅡ': '으',
  'ㅣ': '이',
  'ㅐ': '애',
  'ㅔ': '에',
  'ㅚ': '외',
  'ㅟ': '위',
  'ㅢ': '의',
}
const pronunciationText = computed(() => {
  const glyph = props.question.traceGlyph ?? ''
  return hangulPronunciations[glyph]
    ?? props.question.speechAliases?.find((alias) => alias && alias !== glyph)
    ?? props.question.audioText
    ?? props.question.targetText
    ?? glyph
})
const speechStatusText = computed(() => {
  if (speechState.value === 'listening') return '말하는 중이에요!'
  if (speechState.value === 'retry') return '한 번 더 말해봐요!'
  if (speechState.value === 'success') return '잘 들었어요!'
  return '글자를 따라 읽어요!'
})

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

const stopSpeech = () => {
  if (fallbackTimer) clearTimeout(fallbackTimer)
  fallbackTimer = null
  if (recognition) {
    recognition.onend = null
    recognition.stop()
  }
  recognition = null
}

const normalizeSpeech = (value: string) => value.replace(/[\s.,!?]/g, '').toLowerCase()

const speechMatches = (transcript: string) => {
  const heard = normalizeSpeech(transcript)
  const accepted = [
    props.question.traceGlyph ?? '',
    pronunciationText.value,
    ...(props.question.speechAliases ?? []),
  ].map(normalizeSpeech).filter(Boolean)
  return accepted.some((answer) => heard === answer || heard.includes(answer))
}

const finishSpeech = (isMock: boolean) => {
  if (speechState.value === 'success') return
  stopSpeech()
  speechState.value = 'success'
  emit('guideMessage', '잘했어!\n또박또박 잘 읽었어!')
  session.markRecordingComplete({ isMock, audioUrl: null })
}

const setRetry = () => {
  stopSpeech()
  speechState.value = 'retry'
}

const startSpeech = () => {
  if (!traceCompleted.value || speechState.value === 'listening' || speechState.value === 'success') return
  stopSpeech()
  speechState.value = 'listening'

  if (mockDeviceSubmissionsEnabled) {
    fallbackTimer = setTimeout(() => finishSpeech(true), 1100)
    return
  }

  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition

  if (!Recognition) {
    fallbackTimer = setTimeout(() => finishSpeech(true), 1400)
    return
  }

  recognition = new Recognition()
  recognition.lang = 'ko-KR'
  recognition.interimResults = false
  recognition.continuous = false
  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript ?? ''
    if (speechMatches(transcript)) finishSpeech(false)
    else setRetry()
  }
  recognition.onerror = () => setRetry()
  recognition.onend = () => {
    recognition = null
    if (speechState.value === 'listening') speechState.value = 'retry'
  }
  recognition.start()
}

const playPronunciation = () => audio.replay(pronunciationText.value, 0.72)

const completeTrace = async () => {
  const questionId = props.question.id
  await playPronunciation()
  if (props.question.id !== questionId || !traceCompleted.value) return
  startSpeech()
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
  if (Math.hypot(x - target.x, y - target.y) > 46) return

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
}

const onPointerMove = (event: PointerEvent) => advanceFromClientPoint(event.clientX, event.clientY)
const onGaze = (event: Event) => {
  const detail = (event as CustomEvent<{ clientX?: number; clientY?: number; headPoseStable?: boolean }>).detail
  if (
    detail?.headPoseStable !== false
    && typeof detail?.clientX === 'number'
    && typeof detail?.clientY === 'number'
  ) advanceFromClientPoint(detail.clientX, detail.clientY)
}

const submitTrace = () => {
  const submittedStrokes = recordedStrokes.value
    .filter((points) => points.length >= 2)
    .map((points) => ({ points: points.map((point) => ({ ...point })) }))
  if (submittedStrokes.length === 0) return
  emit('next', {
    canvasWidth: 640,
    canvasHeight: 500,
    strokes: submittedStrokes,
  })
}

const resetQuestion = () => {
  stopSpeech()
  audio.stop()
  progress.value = 0
  speechState.value = 'waiting'
  recordedStrokes.value = []
  traceStartedAt = 0
  emit('guideMessage', '')
}

watch(() => props.question.id, resetQuestion, { immediate: true })
watch(traceCompleted, (completed, wasCompleted) => {
  if (completed && !wasCompleted) void completeTrace()
})

onMounted(() => window.addEventListener('iread:gaze', onGaze))
onBeforeUnmount(() => {
  window.removeEventListener('iread:gaze', onGaze)
  stopSpeech()
  audio.stop()
})
</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <div class="trace-layout">
      <div
        class="trace-stage"
        :class="{ complete: traceCompleted }"
        @pointermove="onPointerMove"
        @pointerdown="onPointerMove"
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
            <polyline
              v-if="completedStroke(strokeIndex).length > 1"
              class="stroke-filled"
              :points="pointString(completedStroke(strokeIndex))"
            />
            <g
              v-if="completedStroke(strokeIndex).length === 0 && stroke[0]"
              class="stroke-start"
              :transform="`translate(${stroke[0].x} ${stroke[0].y})`"
            >
              <circle r="25" />
              <text y="2">{{ strokeIndex + 1 }}</text>
            </g>
          </g>
        </svg>
        <div
          v-if="traceCompleted"
          class="completion-wave"
          role="status"
          aria-label="글자를 끝까지 따라 읽었어요"
          aria-hidden="false"
        ></div>
      </div>

      <aside class="trace-side">
        <section class="listen-panel">
          <span class="panel-label">소리 듣기</span>
          <SoundButton
            :text="pronunciationText"
            :label="`${question.traceGlyph} 소리 듣기`"
            :rate="0.72"
            size="medium"
          />
        </section>

        <section
          class="speech-panel"
          :class="`speech-panel--${speechState}`"
          aria-live="polite"
        >
          <button
            class="mic-state"
            type="button"
            :disabled="speechState === 'waiting' || speechState === 'listening' || speechState === 'success'"
            :aria-label="speechState === 'retry' ? '다시 말하기' : speechStatusText"
            @click="startSpeech"
          >
            <img :src="microphoneIcon" alt="" aria-hidden="true" />
          </button>
          <div class="speech-wave" :class="{ active: speechState === 'listening' }" aria-hidden="true">
            <i v-for="index in 9" :key="index"></i>
          </div>
          <strong>{{ speechStatusText }}</strong>
        </section>
      </aside>
    </div>

    <div class="action-bar">
      <button v-if="speechState === 'success'" class="next-button shared-next-source" type="button" @click="submitTrace">
        다음 문제
      </button>
    </div>
  </section>
</template>

<style scoped src="@/styles/training/activities/GazeTraceActivity.css"></style>
