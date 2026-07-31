<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { TrainingChoice, TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import dragHandleIcon from '@/assets/icons/drag-handle.svg'
import readingActiveIcon from '@/assets/icons/reading-active.svg'

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
const slotsElement = ref<HTMLElement | null>(null)
const choices = computed<TrainingChoice[]>(() => props.question.choices ?? [])
const correctOrder = computed(() => props.question.answer.split('|'))
const slots = ref<(string | null)[]>([])
const attempts = ref(0)
const wrongIndices = ref<number[]>([])
const assemblyCorrect = ref(false)
const statusMessage = ref('')
const speechState = ref<SpeechState>('waiting')
const draggingChoiceId = ref<string | null>(null)
const draggingFromSlot = ref<number | null>(null)
const dragPoint = ref({ x: 0, y: 0 })
const overSlotIndex = ref<number | null>(null)
let wrongTimer: ReturnType<typeof setTimeout> | null = null
let recognition: SpeechRecognitionLike | null = null

const placed = computed(() => slots.value.map((id) => choices.value.find((choice) => choice.id === id) ?? null))
const remaining = computed(() => choices.value.filter((choice) => !slots.value.includes(choice.id)))
const allFilled = computed(() => slots.value.length > 0 && slots.value.every(Boolean))
const isComplete = computed(() => speechState.value === 'success')
const nextEmptyIndex = computed(() => slots.value.findIndex((value) => value === null))
const hintChoiceId = computed(() => {
  if (attempts.value < 2 || assemblyCorrect.value) return null
  const emptyIndex = nextEmptyIndex.value
  return emptyIndex >= 0 ? correctOrder.value[emptyIndex] ?? null : null
})

const reset = () => {
  slots.value = Array.from({ length: choices.value.length }, () => null)
  attempts.value = 0
  wrongIndices.value = []
  assemblyCorrect.value = false
  statusMessage.value = ''
  speechState.value = 'waiting'
  draggingChoiceId.value = null
  draggingFromSlot.value = null
  overSlotIndex.value = null
  recognition?.stop()
  recognition = null
  if (wrongTimer) clearTimeout(wrongTimer)
}
watch(() => props.question.id, reset, { immediate: true })

const normalize = (value: string) => value.replace(/[\s.,!?~'"’“”]/g, '').toLowerCase()
const sentenceMatches = (transcript: string) => {
  const heard = normalize(transcript)
  const answer = normalize(props.question.targetText ?? '')
  return Boolean(answer && (heard === answer || heard.includes(answer)))
}

const finishSpeech = () => {
  if (isComplete.value) return
  speechState.value = 'success'
  statusMessage.value = '다 읽었어!'
  session.markRecordingComplete({ isMock: false, audioUrl: null })
}
const handleTranscript = (transcript: string) => {
  if (!assemblyCorrect.value || speechState.value !== 'listening') return
  if (sentenceMatches(transcript)) finishSpeech()
  else {
    speechState.value = 'retry'
    statusMessage.value = '한 번 더 읽어봐!'
  }
}
const startSpeech = () => {
  if (!assemblyCorrect.value || speechState.value === 'listening' || isComplete.value) return
  speechState.value = 'listening'
  statusMessage.value = '문장을 읽어봐!'
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
      statusMessage.value = '마이크를 켜고 다시 눌러요'
      return
    }
    if (event.error !== 'aborted') {
      speechState.value = 'retry'
      statusMessage.value = '한 번 더 읽어봐!'
    }
  }
  recognition.onend = () => {
    if (speechState.value === 'listening') {
      speechState.value = 'retry'
      statusMessage.value = '한 번 더 읽어봐!'
    }
    recognition = null
  }
  recognition.start()
}

const evaluateSentence = () => {
  if (!allFilled.value || assemblyCorrect.value) return
  const wrong = slots.value
    .map((id, index) => id === correctOrder.value[index] ? -1 : index)
    .filter((index) => index >= 0)

  if (wrong.length === 0) {
    assemblyCorrect.value = true
    statusMessage.value = ''
    speechState.value = 'waiting'
    return
  }

  attempts.value += 1
  wrongIndices.value = wrong
  statusMessage.value = '한 번 더 해봐!'
  if (wrongTimer) clearTimeout(wrongTimer)
  wrongTimer = setTimeout(() => {
    const next = [...slots.value]
    wrong.forEach((index) => { next[index] = null })
    slots.value = next
    wrongIndices.value = []
  }, 700)
}

const slotIndexAt = (clientX: number, clientY: number) => {
  const slotNodes = slotsElement.value?.querySelectorAll<HTMLElement>('.sentence-slot')
  if (!slotNodes) return null
  for (let index = 0; index < slotNodes.length; index += 1) {
    const rect = slotNodes[index]?.getBoundingClientRect()
    if (rect && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) return index
  }
  return null
}
const startPointerDrag = (event: PointerEvent, choiceId: string, fromSlot: number | null) => {
  if (assemblyCorrect.value || event.button !== 0 || wrongIndices.value.length > 0) return
  event.preventDefault()
  draggingChoiceId.value = choiceId
  draggingFromSlot.value = fromSlot
  dragPoint.value = { x: event.clientX, y: event.clientY }
  overSlotIndex.value = slotIndexAt(event.clientX, event.clientY)
}
const onPointerMove = (event: PointerEvent) => {
  if (!draggingChoiceId.value) return
  dragPoint.value = { x: event.clientX, y: event.clientY }
  overSlotIndex.value = slotIndexAt(event.clientX, event.clientY)
}
const finishPointerDrag = (event: PointerEvent) => {
  const choiceId = draggingChoiceId.value
  const origin = draggingFromSlot.value
  if (!choiceId) return
  const target = slotIndexAt(event.clientX, event.clientY)
  draggingChoiceId.value = null
  draggingFromSlot.value = null
  overSlotIndex.value = null

  const next = [...slots.value]
  if (target === null) {
    if (origin !== null) next[origin] = null
  } else if (origin === null) {
    next[target] = choiceId
  } else if (target !== origin) {
    const displaced = next[target] ?? null
    next[target] = choiceId
    next[origin] = displaced
  }
  slots.value = next
  void nextTick(evaluateSentence)
}
const cancelPointerDrag = () => {
  draggingChoiceId.value = null
  draggingFromSlot.value = null
  overSlotIndex.value = null
}
const onExternalSpeech = (event: Event) => {
  const detail = (event as CustomEvent<{ transcript?: string }>).detail
  if (detail?.transcript) handleTranscript(detail.transcript)
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', finishPointerDrag)
  window.addEventListener('pointercancel', cancelPointerDrag)
  window.addEventListener('iread:speech', onExternalSpeech)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', finishPointerDrag)
  window.removeEventListener('pointercancel', cancelPointerDrag)
  window.removeEventListener('iread:speech', onExternalSpeech)
  recognition?.stop()
  if (wrongTimer) clearTimeout(wrongTimer)
})
</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <header class="activity-heading">
      <h1>{{ assemblyCorrect ? '완성한 문장을 읽어봐!' : '문장을 만들어봐!' }}</h1>
      <p v-if="statusMessage" class="status-message" :class="speechState" role="status" aria-live="polite">{{ statusMessage }}</p>
    </header>

    <div ref="slotsElement" class="slots" :style="{ '--slot-count': slots.length }">
      <div
        v-for="(choice, index) in placed"
        :key="index"
        class="sentence-slot"
        :class="{
          filled: choice,
          correct: assemblyCorrect,
          wrong: wrongIndices.includes(index),
          over: overSlotIndex === index,
          hint: hintChoiceId && nextEmptyIndex === index,
        }"
      >
        <span
          v-if="choice"
          class="placed-card"
          @pointerdown="startPointerDrag($event, choice.id, index)"
        >{{ choice.text }}</span>
      </div>
    </div>

    <div class="source-cards choices" :style="{ '--card-count': remaining.length || choices.length }" aria-label="문장 카드">
      <article
        v-for="choice in remaining"
        :key="choice.id"
        class="sentence-card"
        :class="{ hint: hintChoiceId === choice.id }"
        @pointerdown="startPointerDrag($event, choice.id, null)"
      >
        <img class="grip" :src="dragHandleIcon" alt="" aria-hidden="true" />
        <strong>{{ choice.text }}</strong>
      </article>
    </div>

    <Teleport to="body">
      <div
        v-if="draggingChoiceId"
        class="drag-ghost"
        :style="{ left: `${dragPoint.x}px`, top: `${dragPoint.y}px` }"
        aria-hidden="true"
      >{{ choices.find((choice) => choice.id === draggingChoiceId)?.text }}</div>
    </Teleport>

    <footer class="action-bar">
      <button v-if="assemblyCorrect && !isComplete" class="speak-button" type="button" :disabled="speechState === 'listening'" @click="startSpeech">
        <img :src="readingActiveIcon" alt="" aria-hidden="true" />
        {{ speechState === 'listening' ? '듣고 있어' : '문장 읽기' }}
      </button>
      <button v-else-if="isComplete" class="next-button shared-next-source" type="button" @click="$emit('next')">다음</button>
    </footer>
  </section>
</template>

<style scoped src="@/styles/training/activities/SentenceOrderActivity.css"></style>
