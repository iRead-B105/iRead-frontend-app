<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { TracePoint, TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import { useDeviceStatus } from '@/composables/useDeviceStatus'
import SoundButton from '@/components/training/SoundButton.vue'
import microphoneIcon from '@/assets/icons/microphone.svg'
import type { LearnerTraceSubmissionResponse } from '@/features/learner/training'
import { mockVoiceSubmissionsEnabled } from '@/features/learner/training/mockDeviceSubmissions'
import { consonantPronunciationText } from '@/lib/hangulPronunciation'

const props = defineProps<{ question: TrainingQuestion }>()
type VoiceEvaluationControls = {
  success: (message?: string) => void
  retry: (message?: string) => void
}
const emit = defineEmits<{
  next: [response: LearnerTraceSubmissionResponse]
  guideMessage: [message: string]
  voiceRecorded: [blob: Blob, controls: VoiceEvaluationControls]
}>()
type SpeechState = 'waiting' | 'ready' | 'listening' | 'evaluating' | 'retry' | 'success'

const session = useTrainingSession()
const audio = useAudioPlayer()
const recorder = useVoiceRecorder()
const { virtualEyeTrackerConnected } = useDeviceStatus()
const stage = ref<SVGSVGElement | null>(null)
const progress = ref(0)
const speechState = ref<SpeechState>('waiting')
const recordedStrokes = ref<Array<Array<{
  x: number
  y: number
  elapsedMs: number
  pressure?: number
}>>>([])
// 수동 종료를 잊었을 때 업로드 한도를 넘지 않게 하는 안전 상한.
const MAX_RECORDING_MS = 20_000
let traceStartedAt = 0
let fallbackTimer: ReturnType<typeof setTimeout> | null = null
let submittedBlob: Blob | null = null

const strokes = computed(() => props.question.traceStrokes ?? [])
const flatPoints = computed(() => strokes.value.flat())
const totalPoints = computed(() => flatPoints.value.length)
const traceCompleted = computed(() => totalPoints.value > 0 && progress.value >= totalPoints.value)
const currentPoint = computed<TracePoint | null>(() => flatPoints.value[progress.value] ?? null)
const hangulPronunciations: Record<string, string> = {
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
  const consonantText = consonantPronunciationText(glyph)
  if (consonantText !== glyph) return consonantText
  return hangulPronunciations[glyph]
    ?? props.question.speechAliases?.find((alias) => alias && alias !== glyph)
    ?? props.question.audioText
    ?? props.question.targetText
    ?? glyph
})
const speechStatusText = computed(() => {
  if (speechState.value === 'ready') return '마이크를 눌러 읽어봐요!'
  if (speechState.value === 'listening') return '말하는 중이에요! 다 읽으면 눌러요'
  if (speechState.value === 'evaluating') return '목소리를 확인하고 있어요!'
  if (speechState.value === 'retry') return '한 번 더! 마이크를 눌러요'
  if (speechState.value === 'success') return '잘 들었어요!'
  return '글자를 따라 읽어요!'
})
const micToggleEnabled = computed(() =>
  speechState.value === 'ready' || speechState.value === 'retry' || speechState.value === 'listening',
)

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
  recorder.stop()
}

const finishSpeech = (isMock: boolean, blob: Blob | null = null, message?: string) => {
  if (speechState.value === 'success') return
  stopSpeech()
  speechState.value = 'success'
  emit('guideMessage', message || '잘했어!\n또박또박 잘 읽었어!')
  session.markRecordingComplete({ isMock, audioUrl: null, blob })
}

// 재시도 상태로만 전환한다. 재녹음은 아동이 마이크 버튼을 다시 눌러 시작한다.
const setRetry = (message?: string) => {
  stopSpeech()
  recorder.reset()
  submittedBlob = null
  speechState.value = 'retry'
  if (message) emit('guideMessage', message)
}

const startSpeech = async () => {
  if (!traceCompleted.value || speechState.value === 'listening' || speechState.value === 'success') return
  stopSpeech()
  recorder.reset()
  submittedBlob = null
  speechState.value = 'listening'

  if (mockVoiceSubmissionsEnabled) {
    fallbackTimer = setTimeout(() => finishSpeech(true), 1100)
    return
  }

  await recorder.start()
  if (recorder.state.status !== 'recording') {
    setRetry(recorder.state.errorMessage ?? '마이크를 확인해 주세요.')
    return
  }
  // 종료는 버튼 클릭이 기본. 업로드 한도를 넘지 않도록 안전 상한만 둔다.
  fallbackTimer = setTimeout(() => recorder.stop(), MAX_RECORDING_MS)
}

// 마이크 버튼 토글: 대기/재시도 상태면 녹음 시작, 녹음 중이면 종료.
const toggleSpeech = () => {
  if (speechState.value === 'listening') {
    if (mockVoiceSubmissionsEnabled) {
      finishSpeech(true)
      return
    }
    stopSpeech()
    return
  }
  if (speechState.value === 'ready' || speechState.value === 'retry') void startSpeech()
}

watch(() => recorder.state.status, (status) => {
  const blob = recorder.audioBlob.value
  if (status !== 'recorded' || !blob || blob === submittedBlob) return
  submittedBlob = blob
  speechState.value = 'evaluating'
  emit('voiceRecorded', blob, {
    success: (message) => finishSpeech(false, blob, message),
    retry: (message) => setRetry(message),
  })
})

const playPronunciation = () => audio.replay(pronunciationText.value, 0.72)

const emitGazeWordHit = (clientX: number, clientY: number) => {
  const text =
    props.question.traceGlyph
    ?? props.question.targetText
    ?? props.question.targetResult
    ?? pronunciationText.value
  if (!text) return
  window.dispatchEvent(new CustomEvent('iread:gaze-word-hit', {
    detail: {
      clientX,
      clientY,
      tokenIndex: 0,
      text,
    },
  }))
}

const completeTrace = async () => {
  const questionId = props.question.id
  await playPronunciation()
  if (props.question.id !== questionId || !traceCompleted.value) return
  // 발음을 들려준 뒤 아동이 마이크 버튼을 눌러 직접 녹음을 시작한다.
  speechState.value = 'ready'
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

  emitGazeWordHit(clientX, clientY)
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

const onPointerMove = (event: PointerEvent) => {
  if (!virtualEyeTrackerConnected.value) {
    advanceFromClientPoint(event.clientX, event.clientY)
  }
}
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
  submittedBlob = null
  recorder.reset()
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
            type="button"
            class="mic-state"
            :disabled="!micToggleEnabled"
            :aria-label="speechStatusText"
            @click="toggleSpeech"
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
