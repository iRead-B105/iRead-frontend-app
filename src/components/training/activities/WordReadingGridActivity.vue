<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { TrainingQuestion, WordReadingItem } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { useDeviceStatus } from '@/composables/useDeviceStatus'
import checkIcon from '@/assets/icons/check.svg'
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
const session = useTrainingSession()
const { microphoneAvailable, virtualEyeTrackerConnected } = useDeviceStatus()
const grid = ref<HTMLElement | null>(null)
const started = ref(false)
const activeIndex = ref(0)
const completedIds = ref<string[]>([])
const gazeIndex = ref<number | null>(null)
const gazePoint = ref({ x: 0, y: 0 })
const gazeVisible = ref(false)
const dwellProgress = ref(0)

let recognition: SpeechRecognitionLike | null = null
let recognitionRunning = false
let recognitionBlocked = false
let recognitionRestart: ReturnType<typeof setTimeout> | null = null
let stateTimer: ReturnType<typeof setInterval> | null = null
let dwellStartedAt = 0
let disposed = false

const items = computed<WordReadingItem[]>(() => {
  if (props.question.readingWords?.length) return props.question.readingWords
  const text = props.question.targetText?.trim()
  return text ? [{ id: `${props.question.id}-reading`, text }] : []
})
const singleItemNeedsWrapping = computed(() => {
  const text = items.value[0]?.text.trim() ?? ''
  return items.value.length === 1 && (text.length > 7 || /\s/.test(text))
})
const allComplete = computed(() => items.value.length > 0 && completedIds.value.length === items.value.length)
const activeWord = computed(() => items.value[activeIndex.value] ?? null)
const completeByRealGaze = computed(() =>
  mockVoiceSubmissionsEnabled
  && !mockGazeSubmissionsEnabled
  && props.question.requiredInputs?.includes('GAZE'),
)
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
  if (disposed || !started.value || allComplete.value || recognitionBlocked) return
  if (recognitionRestart) clearTimeout(recognitionRestart)
  recognitionRestart = setTimeout(startRecognition, 220)
}

const finishAllWords = () => {
  stopRecognition()
  session.markRecordingComplete({ isMock: false, audioUrl: null })
}

const acceptCurrentWord = () => {
  const word = activeWord.value
  if (!word || completedIds.value.includes(word.id)) return
  completedIds.value = [...completedIds.value, word.id]
  dwellStartedAt = 0
  dwellProgress.value = 0
  if (completedIds.value.length === items.value.length) {
    finishAllWords()
    return
  }
  activeIndex.value += 1
}

const handleTranscript = (transcript: string) => {
  if (!started.value || allComplete.value) return
  if (matchesActiveWord(transcript)) acceptCurrentWord()
}

function startRecognition() {
  if (disposed || recognitionRunning || recognitionBlocked || !started.value || allComplete.value) return
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
    if (disposed || allComplete.value) return
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
      recognitionBlocked = true
      return
    }
    // 장치·네트워크 오류는 발음 실패로 세지 않는다. 실제 발화가 들어왔지만
    // 현재 낱말과 다를 때만 handleTranscript에서 실패 횟수를 올린다.
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
  started.value = true
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
  if (!virtualEyeTrackerConnected.value) updateGaze(event.clientX, event.clientY, true)
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

onMounted(() => {
  window.addEventListener('iread:gaze', onGaze)
  window.addEventListener('iread:speech', onExternalSpeech)
  stateTimer = setInterval(() => {
    if (!started.value || allComplete.value) return
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
  }, 50)
  void nextTick(startReading)
})

watch(() => props.question.id, () => {
  stopRecognition()
  recognitionBlocked = false
  started.value = false
  activeIndex.value = 0
  completedIds.value = []
  void nextTick(startReading)
})

watch(microphoneAvailable, (available) => {
  if (!available || !recognitionBlocked || !started.value || allComplete.value) return
  recognitionBlocked = false
  scheduleRecognition()
})

onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('iread:gaze', onGaze)
  window.removeEventListener('iread:speech', onExternalSpeech)
  if (stateTimer) clearInterval(stateTimer)
  stopRecognition()
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
        :class="{
          'word-grid--single': items.length === 1,
          'word-grid--single-row': items.length <= 2,
          'word-grid--sentence': singleItemNeedsWrapping,
        }"
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
          }"
        >
          <img v-if="completedIds.includes(word.id)" class="complete-mark" :src="checkIcon" alt="읽기 완료" />
          <strong>{{ word.text }}</strong>
        </article>
      </div>

      <aside class="reading-side">
        <footer class="action-bar">
          <button v-if="allComplete" class="next-button shared-next-source" type="button" @click="$emit('next')">다음</button>
        </footer>
      </aside>
    </div>
  </section>
</template>

<style scoped src="@/styles/training/activities/WordReadingGridActivity.css"></style>
