<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ReadingSentence, TrainingQuestion } from '@/types/training'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useTrainingSession } from '@/composables/useTrainingSession'
import readingActiveIcon from '@/assets/icons/reading-active.svg'
import progressStar from '@/assets/training/ui/progress-star.png'

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
type MessageState = 'ready' | 'listening' | 'retry' | 'help' | 'pause' | 'complete' | 'denied'

const session = useTrainingSession()
const { replay, stop: stopAudio } = useAudioPlayer()
const sentenceStage = ref<HTMLElement | null>(null)
const started = ref(false)
const activeIndex = ref(0)
const completedCount = ref(0)
const failureCount = ref(0)
const assistIndex = ref<number | null>(null)
const gazeIndex = ref<number | null>(null)
const gazePoint = ref({ x: 0, y: 0 })
const gazeVisible = ref(false)
const dwellProgress = ref(0)
const messageState = ref<MessageState>('ready')
const betweenSentences = ref(false)

let recognition: SpeechRecognitionLike | null = null
let recognitionRunning = false
let recognitionRestart: ReturnType<typeof setTimeout> | null = null
let stateTimer: ReturnType<typeof setInterval> | null = null
let sentenceAdvanceTimer: ReturnType<typeof setTimeout> | null = null
let lastProgressAt = Date.now()
let dwellStartedAt = 0
let readingHelp = false
let disposed = false

const sentences = computed<ReadingSentence[]>(() => {
  if (props.question.readingSentences?.length) return props.question.readingSentences
  return [{ id: `${props.question.id}-line`, chunks: props.question.phraseChunks ?? [] }]
})
const entries = computed(() => sentences.value.flatMap((sentence, sentenceIndex) =>
  sentence.chunks.map((text, localIndex) => ({ text, sentenceIndex, localIndex })),
))
const chunks = computed(() => entries.value.map((entry) => entry.text))
const sentenceRanges = computed(() => {
  let cursor = 0
  return sentences.value.map((sentence) => {
    const start = cursor
    cursor += sentence.chunks.length
    return { start, end: cursor }
  })
})
const activeSentenceIndex = computed(() =>
  sentenceRanges.value.findIndex((range) => activeIndex.value >= range.start && activeIndex.value < range.end),
)
const allComplete = computed(() => chunks.value.length > 0 && completedCount.value >= chunks.value.length)
const statusMessage = computed(() => {
  switch (messageState.value) {
    case 'listening': return '읽고 있어'
    case 'retry': return '한 번 더 읽어봐!'
    case 'help': return '빛나는 말을 바라봐!'
    case 'pause': return '다음 문장을 읽어!'
    case 'complete': return '다 읽었어!'
    case 'denied': return '마이크를 켜고 다시 눌러요'
    default: return '준비되면 시작해!'
  }
})

const normalize = (value: string) => value.replace(/[\s.,!?~'"’“”]/g, '').toLowerCase()

const consecutiveMatches = (transcript: string) => {
  const heard = normalize(transcript)
  let searchFrom = 0
  let count = 0
  const currentRange = sentenceRanges.value[activeSentenceIndex.value]
  const sentenceEnd = currentRange?.end ?? chunks.value.length
  for (let index = activeIndex.value; index < sentenceEnd; index += 1) {
    const target = normalize(chunks.value[index] ?? '')
    const foundAt = target ? heard.indexOf(target, searchFrom) : -1
    if (foundAt < 0) break
    count += 1
    searchFrom = foundAt + target.length
  }
  return count
}

const stopRecognition = () => {
  if (recognitionRestart) clearTimeout(recognitionRestart)
  recognitionRestart = null
  if (recognition && recognitionRunning) {
    recognitionRunning = false
    recognition.stop()
  }
  recognition = null
}

const scheduleRecognition = () => {
  if (disposed || !started.value || allComplete.value || readingHelp || betweenSentences.value || messageState.value === 'denied') return
  if (recognitionRestart) clearTimeout(recognitionRestart)
  recognitionRestart = setTimeout(startRecognition, 220)
}

const activateAssist = () => {
  if (allComplete.value || betweenSentences.value || assistIndex.value !== null) return
  assistIndex.value = activeIndex.value
  messageState.value = 'help'
  dwellStartedAt = 0
  dwellProgress.value = 0
}

const finishSentence = () => {
  assistIndex.value = null
  messageState.value = 'complete'
  stopRecognition()
  session.markRecordingComplete({ isMock: false, audioUrl: null })
}

const acceptChunks = (count: number) => {
  if (count <= 0 || allComplete.value) return
  const nextCount = Math.min(chunks.value.length, completedCount.value + count)
  completedCount.value = nextCount
  failureCount.value = 0
  assistIndex.value = null
  dwellStartedAt = 0
  dwellProgress.value = 0
  lastProgressAt = Date.now()
  if (nextCount >= chunks.value.length) {
    activeIndex.value = Math.max(0, chunks.value.length - 1)
    finishSentence()
    return
  }

  const currentRange = sentenceRanges.value[activeSentenceIndex.value]
  if (currentRange && nextCount >= currentRange.end) {
    betweenSentences.value = true
    messageState.value = 'pause'
    stopRecognition()
    sentenceAdvanceTimer = setTimeout(() => {
      betweenSentences.value = false
      activeIndex.value = nextCount
      lastProgressAt = Date.now()
      messageState.value = 'listening'
      scheduleRecognition()
    }, 1000)
  } else {
    activeIndex.value = nextCount
    messageState.value = 'listening'
  }
}

const rejectChunk = () => {
  if (allComplete.value) return
  failureCount.value += 1
  messageState.value = 'retry'
  if (failureCount.value >= 2) activateAssist()
}

const handleTranscript = (transcript: string) => {
  if (!started.value || allComplete.value || readingHelp || betweenSentences.value) return
  const matched = consecutiveMatches(transcript)
  if (matched > 0) acceptChunks(matched)
  else rejectChunk()
}

function startRecognition() {
  if (disposed || recognitionRunning || !started.value || allComplete.value || readingHelp || betweenSentences.value) return
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
  if (!Recognition) return

  recognition = new Recognition()
  recognition.lang = 'ko-KR'
  recognition.interimResults = false
  recognition.continuous = false
  recognition.onresult = (event) => handleTranscript(event.results[0]?.[0]?.transcript ?? '')
  recognition.onerror = (event) => {
    recognitionRunning = false
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
      window.dispatchEvent(new CustomEvent('iread:microphone-state', { detail: { active: false, available: false } }))
      messageState.value = 'denied'
      return
    }
    if (event.error !== 'aborted') messageState.value = 'retry'
  }
  recognition.onend = () => {
    recognitionRunning = false
    recognition = null
    scheduleRecognition()
  }
  try {
    recognitionRunning = true
    recognition.start()
  } catch {
    recognitionRunning = false
    scheduleRecognition()
  }
}

const startReading = () => {
  if (allComplete.value) return
  stopAudio()
  started.value = true
  messageState.value = 'listening'
  lastProgressAt = Date.now()
  startRecognition()
}

const chunkIndexAt = (clientX: number, clientY: number) => {
  const elements = sentenceStage.value?.querySelectorAll<HTMLElement>('.sentence-chunk')
  if (!elements) return null
  for (let index = 0; index < elements.length; index += 1) {
    const rect = elements[index]?.getBoundingClientRect()
    if (rect && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) return index
  }
  return null
}

const globalChunkIndex = (sentenceIndex: number, localIndex: number) =>
  (sentenceRanges.value[sentenceIndex]?.start ?? 0) + localIndex

const isSentenceComplete = (sentenceIndex: number) => {
  const range = sentenceRanges.value[sentenceIndex]
  return Boolean(range && completedCount.value >= range.end)
}

const updateGaze = (clientX: number, clientY: number) => {
  gazePoint.value = { x: clientX, y: clientY }
  gazeVisible.value = true
  gazeIndex.value = chunkIndexAt(clientX, clientY)
}
const onPointerMove = (event: PointerEvent) => updateGaze(event.clientX, event.clientY)
const onPointerLeave = () => {
  gazeVisible.value = false
  gazeIndex.value = null
  dwellStartedAt = 0
  dwellProgress.value = 0
}
const onGaze = (event: Event) => {
  const detail = (event as CustomEvent<{ clientX?: number; clientY?: number; headPoseStable?: boolean }>).detail
  if (
    detail?.headPoseStable !== false
    && typeof detail?.clientX === 'number'
    && typeof detail?.clientY === 'number'
  ) updateGaze(detail.clientX, detail.clientY)
}
const onExternalSpeech = (event: Event) => {
  const detail = (event as CustomEvent<{ transcript?: string }>).detail
  if (detail?.transcript) handleTranscript(detail.transcript)
}

const readAssistedChunk = async () => {
  const index = assistIndex.value
  const chunk = index === null ? null : chunks.value[index]
  if (!chunk || readingHelp) return
  readingHelp = true
  stopRecognition()
  messageState.value = 'help'
  await Promise.race([
    replay(chunk, 0.74),
    new Promise<void>((resolve) => setTimeout(resolve, 3200)),
  ])
  stopAudio()
  readingHelp = false
  assistIndex.value = null
  failureCount.value = 0
  dwellStartedAt = 0
  dwellProgress.value = 0
  lastProgressAt = Date.now()
  messageState.value = 'listening'
  scheduleRecognition()
}

onMounted(() => {
  window.addEventListener('iread:gaze', onGaze)
  window.addEventListener('iread:speech', onExternalSpeech)
  stateTimer = setInterval(() => {
    if (!started.value || allComplete.value || readingHelp || betweenSentences.value) return
    if (assistIndex.value === null && Date.now() - lastProgressAt >= 8000) activateAssist()
    if (assistIndex.value !== null && gazeIndex.value === assistIndex.value) {
      if (!dwellStartedAt) dwellStartedAt = Date.now()
      dwellProgress.value = Math.min(1, (Date.now() - dwellStartedAt) / 1000)
      if (dwellProgress.value >= 1) void readAssistedChunk()
    } else {
      dwellStartedAt = 0
      dwellProgress.value = 0
    }
  }, 50)
})

onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('iread:gaze', onGaze)
  window.removeEventListener('iread:speech', onExternalSpeech)
  if (stateTimer) clearInterval(stateTimer)
  if (sentenceAdvanceTimer) clearTimeout(sentenceAdvanceTimer)
  stopRecognition()
  stopAudio()
})
</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <header class="activity-heading">
      <h1>{{ allComplete ? '다 읽었어!' : question.instruction }}</h1>
      <div class="reading-status" :class="messageState" role="status" aria-live="polite">
        <img :src="allComplete ? progressStar : readingActiveIcon" alt="" aria-hidden="true" />
        {{ statusMessage }}
      </div>
    </header>

    <div
      ref="sentenceStage"
      class="sentence-stage"
      :class="{ multi: sentences.length > 1 }"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
    >
      <div class="passage" aria-label="읽을 글">
        <p
          v-for="(sentence, sentenceIndex) in sentences"
          :key="sentence.id"
          class="sentence-row"
          :class="{ 'row-complete': isSentenceComplete(sentenceIndex) }"
        >
          <span
            v-for="(chunk, localIndex) in sentence.chunks"
            :key="`${sentence.id}-${localIndex}`"
            class="sentence-chunk"
            :class="{
              active: started && globalChunkIndex(sentenceIndex, localIndex) === activeIndex && !allComplete && !betweenSentences,
              gazed: gazeIndex === globalChunkIndex(sentenceIndex, localIndex),
              complete: globalChunkIndex(sentenceIndex, localIndex) < completedCount,
              assist: assistIndex === globalChunkIndex(sentenceIndex, localIndex),
            }"
          >
            <span class="chunk-text">{{ chunk }}</span>
            <span v-if="assistIndex === globalChunkIndex(sentenceIndex, localIndex)" class="assist-sweep" aria-hidden="true"></span>
            <img
              v-if="globalChunkIndex(sentenceIndex, localIndex) < completedCount"
              class="read-mark"
              :src="readingActiveIcon"
              alt=""
              aria-hidden="true"
            />
          </span>
        </p>
      </div>
    </div>

    <footer class="action-bar">
      <button v-if="!started" class="start-button" type="button" @click="startReading"><img :src="readingActiveIcon" alt="" aria-hidden="true" /> 읽기 시작</button>
      <button v-else-if="messageState === 'denied'" class="start-button" type="button" @click="startReading">다시 시작</button>
      <button v-else-if="allComplete" class="next-button" type="button" @click="$emit('next')">다음</button>
    </footer>
  </section>
</template>

<style scoped src="@/styles/training/activities/SentenceReadingActivity.css"></style>
