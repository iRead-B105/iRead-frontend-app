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
import { consonantPronunciationText } from '@/lib/hangulPronunciation'
import { cursorGazeFallbackActive } from '@/lib/cursorGazeFallback'

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
type SpeechState = 'waiting' | 'listening' | 'evaluating' | 'retry' | 'success' | 'denied'

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
let traceStartedAt = 0
let fallbackTimer: ReturnType<typeof setTimeout> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
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
const deniedMessage = ref('')
const speechStatusText = computed(() => {
  if (speechState.value === 'listening') return '말하는 중이에요!'
  if (speechState.value === 'evaluating') return '목소리를 확인하고 있어요!'
  if (speechState.value === 'retry') return '한 번 더 말해봐요!'
  if (speechState.value === 'success') return '잘 들었어요!'
  if (speechState.value === 'denied') return deniedMessage.value || '마이크를 켜 주세요'
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
  recorder.stop()
}

const finishSpeech = (blob: Blob | null = null, message?: string) => {
  if (speechState.value === 'success') return
  stopSpeech()
  speechState.value = 'success'
  emit('guideMessage', message || '잘했어!\n또박또박 잘 읽었어!')
  session.markRecordingComplete({ audioUrl: null, blob })
}

const setRetry = (message?: string) => {
  stopSpeech()
  if (retryTimer) clearTimeout(retryTimer)
  recorder.reset()
  submittedBlob = null
  speechState.value = 'retry'
  if (message) emit('guideMessage', message)
  retryTimer = setTimeout(() => void startSpeech(), 1_100)
}

const startSpeech = async () => {
  if (!traceCompleted.value || speechState.value === 'listening' || speechState.value === 'success') return
  stopSpeech()
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  recorder.reset()
  submittedBlob = null
  speechState.value = 'listening'

  await recorder.start()
  if (recorder.state.status !== 'recording') {
    // 마이크가 아예 열리지 않으면(권한 거부·장치 분리) 1.1초 재시도 루프에
    // 갇히지 않도록 이유를 화면에 밝히고 멈춘다.
    stopSpeech()
    if (retryTimer) clearTimeout(retryTimer)
    deniedMessage.value = recorder.state.errorMessage ?? '마이크를 켜 주세요'
    speechState.value = 'denied'
    return
  }
  // 한 글자 발화에 충분한 시간을 준 뒤 자동으로 녹음을 끝낸다.
  fallbackTimer = setTimeout(() => recorder.stop(), 5_000)
}

watch(() => recorder.state.status, (status) => {
  const blob = recorder.audioBlob.value
  if (status !== 'recorded' || !blob || blob === submittedBlob) return
  submittedBlob = blob
  speechState.value = 'evaluating'
  emit('voiceRecorded', blob, {
    success: (message) => finishSpeech(blob, message),
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
  await startSpeech()
}

// 안내점 간격(38px)보다 넉넉한 판정 반경. 아동 시선의 미세한 보정 오차를 흡수한다.
const HIT_RADIUS_PX = 56
// 시선은 사카드(점프)로 움직여 중간 점을 건너뛰므로, 진행 순서상 조금 앞의
// 점까지 내다보고 반경에 들어온 가장 먼 점까지 한 번에 채운다.
const LOOKAHEAD_POINTS = 5

const advanceFromClientPoint = (clientX: number, clientY: number) => {
  const svg = stage.value
  if (!svg || traceCompleted.value) return

  const screenMatrix = svg.getScreenCTM()
  if (!screenMatrix) return
  const localPoint = new DOMPoint(clientX, clientY).matrixTransform(screenMatrix.inverse())
  const x = localPoint.x
  const y = localPoint.y

  const guidePoints = flatPoints.value
  let hitIndex = -1
  const lookaheadEnd = Math.min(guidePoints.length - 1, progress.value + LOOKAHEAD_POINTS)
  for (let index = progress.value; index <= lookaheadEnd; index += 1) {
    const candidate = guidePoints[index]!
    if (Math.hypot(x - candidate.x, y - candidate.y) <= HIT_RADIUS_PX) hitIndex = index
  }
  if (hitIndex < 0) return

  emitGazeWordHit(clientX, clientY)
  if (traceStartedAt === 0) traceStartedAt = Date.now()
  while (progress.value <= hitIndex) {
    const target = guidePoints[progress.value]!
    const isGazePoint = progress.value === hitIndex
    const strokeIndex = strokeIndexAt(progress.value)
    const points = recordedStrokes.value[strokeIndex] ?? []
    if (!recordedStrokes.value[strokeIndex]) recordedStrokes.value[strokeIndex] = points
    points.push({
      x: Math.max(0, isGazePoint ? x : target.x),
      y: Math.max(0, isGazePoint ? y : target.y),
      elapsedMs: Date.now() - traceStartedAt,
    })
    progress.value += 1
  }
}

const onPointerMove = (event: PointerEvent) => {
  // 가상 아이트래커는 iread:gaze 이벤트로 시선을 보내므로 pointermove는 무시한다.
  // 커서 폴백은 아이트래커 미연결 시 자동으로 켜진다.
  if (virtualEyeTrackerConnected.value || !cursorGazeFallbackActive.value) return
  advanceFromClientPoint(event.clientX, event.clientY)
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
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
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
  if (retryTimer) clearTimeout(retryTimer)
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
          <!-- 외곽선 전체 → 중심선 전체 순서로 그려야 획 접점에 이음새가 안 생기고
               글자가 하나로 이어져 보인다. (획별로 번갈아 그리면 다음 획의 외곽선이
               이전 획의 중심을 덮어 ㅏ가 ㅣ·ㅡ 두 조각처럼 보인다) -->
          <g class="glyph-body" aria-hidden="true">
            <polyline
              v-for="(stroke, strokeIndex) in strokes"
              :key="`outline-${strokeIndex}`"
              class="stroke-outline"
              :points="pointString(stroke)"
            />
            <polyline
              v-for="(stroke, strokeIndex) in strokes"
              :key="`guide-${strokeIndex}`"
              class="stroke-guide"
              :points="pointString(stroke)"
            />
          </g>
          <g v-for="(stroke, strokeIndex) in strokes" :key="`base-${strokeIndex}`">
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
          <div
            class="mic-state"
            role="status"
            :aria-label="speechStatusText"
          >
            <img :src="microphoneIcon" alt="" aria-hidden="true" />
          </div>
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
