<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { TrainingQuestion, WordReadingItem } from '@/types/training'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useDeviceStatus } from '@/composables/useDeviceStatus'
import { useTrainingSession } from '@/composables/useTrainingSession'
import readingActiveIcon from '@/assets/icons/reading-active.svg'
import checkIcon from '@/assets/icons/check.svg'
import progressStar from '@/assets/training/ui/progress-star.png'
import {
  mockGazeSubmissionsEnabled,
  mockVoiceSubmissionsEnabled,
} from '@/features/learner/training/mockDeviceSubmissions'

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
type MessageState = 'ready' | 'listening' | 'retry' | 'help' | 'complete' | 'denied'

const session = useTrainingSession()
const { replay, stop: stopAudio } = useAudioPlayer()
const { virtualEyeTrackerConnected } = useDeviceStatus()
const grid = ref<HTMLElement | null>(null)
const started = ref(false)
const activeIndex = ref(0)
const completedIds = ref<string[]>([])
const failureCount = ref(0)
const assistIndex = ref<number | null>(null)
const gazeIndex = ref<number | null>(null)
const gazePoint = ref({ x: 0, y: 0 })
const gazeVisible = ref(false)
const dwellProgress = ref(0)
const messageState = ref<MessageState>('ready')

let recognition: SpeechRecognitionLike | null = null
let recognitionRunning = false
let recognitionRestart: ReturnType<typeof setTimeout> | null = null
let stateTimer: ReturnType<typeof setInterval> | null = null
let lastProgressAt = Date.now()
let dwellStartedAt = 0
let readingHelp = false
let disposed = false

const items = computed<WordReadingItem[]>(() => {
  if (props.question.readingWords?.length) return props.question.readingWords
  const text = props.question.targetText?.trim()
  return text ? [{ id: `${props.question.id}-reading`, text }] : []
})
const allComplete = computed(() => items.value.length > 0 && completedIds.value.length === items.value.length)
const activeWord = computed(() => items.value[activeIndex.value] ?? null)
const completeByRealGaze = computed(() =>
  mockVoiceSubmissionsEnabled
  && !mockGazeSubmissionsEnabled
  && props.question.requiredInputs?.includes('GAZE'),
)
const statusMessage = computed(() => {
  switch (messageState.value) {
    case 'listening': return '읽고 있어'
    case 'retry': return '한 번 더 읽어봐!'
    case 'help': return '빛나는 낱말을 바라봐!'
    case 'complete': return '다 읽었어!'
    case 'denied': return '마이크를 켜고 다시 눌러요'
    default: return '준비되면 시작해!'
  }
})

const normalize = (value: string) => value.replace(/[\s.,!?~'"’“”]/g, '').toLowerCase()

const matchesActiveWord = (transcript: string) => {
  const word = activeWord.value
  if (!word) return false
  const heard = normalize(transcript)
  return [word.text, ...(word.speechAliases ?? [])]
    .map(normalize)
    .some((answer) => heard === answer || heard.includes(answer))
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
  if (disposed || !started.value || allComplete.value || readingHelp || messageState.value === 'denied') return
  if (recognitionRestart) clearTimeout(recognitionRestart)
  recognitionRestart = setTimeout(startRecognition, 220)
}

const activateAssist = () => {
  if (allComplete.value || assistIndex.value !== null) return
  assistIndex.value = activeIndex.value
  messageState.value = 'help'
  dwellStartedAt = 0
  dwellProgress.value = 0
}

const finishAllWords = () => {
  assistIndex.value = null
  messageState.value = 'complete'
  stopRecognition()
  session.markRecordingComplete({ isMock: false, audioUrl: null })
}

const acceptCurrentWord = () => {
  const word = activeWord.value
  if (!word || completedIds.value.includes(word.id)) return
  completedIds.value = [...completedIds.value, word.id]
  failureCount.value = 0
  assistIndex.value = null
  dwellStartedAt = 0
  dwellProgress.value = 0
  lastProgressAt = Date.now()
  if (completedIds.value.length === items.value.length) {
    finishAllWords()
    return
  }
  activeIndex.value += 1
  messageState.value = 'listening'
}

const rejectCurrentWord = () => {
  if (allComplete.value) return
  failureCount.value += 1
  messageState.value = 'retry'
  if (failureCount.value >= 2) activateAssist()
}

const handleTranscript = (transcript: string) => {
  if (!started.value || allComplete.value || readingHelp) return
  if (matchesActiveWord(transcript)) acceptCurrentWord()
  else rejectCurrentWord()
}

function startRecognition() {
  if (disposed || recognitionRunning || !started.value || allComplete.value || readingHelp) return
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
  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript ?? ''
    handleTranscript(transcript)
  }
  recognition.onerror = (event) => {
    recognitionRunning = false
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
      window.dispatchEvent(new CustomEvent('iread:microphone-state', { detail: { active: false, available: false } }))
      messageState.value = 'denied'
      return
    }
    // 장치·네트워크 오류는 발음 실패로 세지 않는다. 실제 발화가 들어왔지만
    // 현재 낱말과 다를 때만 handleTranscript에서 실패 횟수를 올린다.
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
  if (mockVoiceSubmissionsEnabled && !completeByRealGaze.value) {
    completedIds.value = items.value.map((item) => item.id)
    finishAllWords()
    return
  }
  if (completeByRealGaze.value) return
  startRecognition()
}

const cardIndexAt = (clientX: number, clientY: number) => {
  const cards = grid.value?.querySelectorAll<HTMLElement>('.word-card')
  if (!cards) return null
  for (let index = 0; index < cards.length; index += 1) {
    const rect = cards[index]?.getBoundingClientRect()
    if (rect && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) return index
  }
  return null
}

const emitGazeWordHit = (clientX: number, clientY: number, tokenIndex: number) => {
  const text = items.value[tokenIndex]?.text
  if (typeof text !== 'string') return
  window.dispatchEvent(new CustomEvent('iread:gaze-word-hit', {
    detail: {
      clientX,
      clientY,
      tokenIndex,
      text,
    },
  }))
}

const updateGaze = (clientX: number, clientY: number, emitWordHit = false) => {
  gazePoint.value = { x: clientX, y: clientY }
  gazeVisible.value = true
  const nextGazeIndex = cardIndexAt(clientX, clientY)
  gazeIndex.value = nextGazeIndex
  if (emitWordHit && nextGazeIndex !== null) {
    emitGazeWordHit(clientX, clientY, nextGazeIndex)
  }
}

const onPointerMove = (event: PointerEvent) => {
  if (!virtualEyeTrackerConnected.value) updateGaze(event.clientX, event.clientY)
}
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
  ) updateGaze(detail.clientX, detail.clientY, true)
}
const onExternalSpeech = (event: Event) => {
  const detail = (event as CustomEvent<{ transcript?: string }>).detail
  if (detail?.transcript) handleTranscript(detail.transcript)
}

const readAssistedWord = async () => {
  const index = assistIndex.value
  const word = index === null ? null : items.value[index]
  if (!word || readingHelp) return
  readingHelp = true
  stopRecognition()
  messageState.value = 'help'
  await Promise.race([
    replay(word.text, 0.72),
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
    if (!started.value || allComplete.value || readingHelp) return
    if (completeByRealGaze.value) {
      if (gazeIndex.value === activeIndex.value) {
        if (!dwellStartedAt) dwellStartedAt = Date.now()
        dwellProgress.value = Math.min(1, (Date.now() - dwellStartedAt) / 900)
        if (dwellProgress.value >= 1) acceptCurrentWord()
      } else {
        dwellStartedAt = 0
        dwellProgress.value = 0
      }
      return
    }
    if (assistIndex.value === null && Date.now() - lastProgressAt >= 8000) activateAssist()

    if (assistIndex.value !== null && gazeIndex.value === assistIndex.value) {
      if (!dwellStartedAt) dwellStartedAt = Date.now()
      dwellProgress.value = Math.min(1, (Date.now() - dwellStartedAt) / 1000)
      if (dwellProgress.value >= 1) void readAssistedWord()
    } else {
      dwellStartedAt = 0
      dwellProgress.value = 0
    }
  }, 50)
  void nextTick(startReading)
})

watch(() => props.question.id, () => {
  stopRecognition()
  started.value = false
  activeIndex.value = 0
  completedIds.value = []
  failureCount.value = 0
  assistIndex.value = null
  messageState.value = 'ready'
  void nextTick(startReading)
})

onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('iread:gaze', onGaze)
  window.removeEventListener('iread:speech', onExternalSpeech)
  if (stateTimer) clearInterval(stateTimer)
  stopRecognition()
  stopAudio()
})
</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <header class="activity-heading">
      <h1>{{ allComplete ? '다 읽었어!' : question.instruction }}</h1>
    </header>

    <div class="reading-layout">
      <div
        ref="grid"
        class="word-grid"
        :class="{ 'word-grid--single': items.length === 1 }"
        @pointermove="onPointerMove"
        @pointerleave="onPointerLeave"
      >
        <article
          v-for="(word, index) in items"
          :key="word.id"
          class="word-card"
          :class="{
            active: started && index === activeIndex && !allComplete,
            gazed: gazeIndex === index,
            complete: completedIds.includes(word.id),
            assist: assistIndex === index,
          }"
        >
          <img v-if="completedIds.includes(word.id)" class="complete-mark" :src="checkIcon" alt="읽기 완료" />
          <strong>{{ word.text }}</strong>
          <span v-if="assistIndex === index" class="assist-sweep" aria-hidden="true"></span>
        </article>
      </div>

      <aside class="reading-side">
        <div class="reading-status" :class="messageState" role="status" aria-live="polite">
          <img class="status-icon" :src="allComplete ? progressStar : readingActiveIcon" alt="" aria-hidden="true" />
          {{ statusMessage }}
        </div>
        <footer class="action-bar">
          <button v-if="allComplete" class="next-button shared-next-source" type="button" @click="$emit('next')">다음</button>
        </footer>
      </aside>
    </div>
  </section>
</template>

<style scoped src="@/styles/training/activities/WordReadingGridActivity.css"></style>
