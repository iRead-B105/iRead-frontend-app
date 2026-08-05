<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ReadingItem, TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { useDeviceStatus } from '@/composables/useDeviceStatus'
import { useDeveloperMode } from '@/composables/useDeveloperMode'
import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import checkIcon from '@/assets/icons/check.svg'
import microphoneIcon from '@/assets/icons/microphone.svg'
import { cursorGazeFallbackEnabled } from '@/lib/cursorGazeFallback'

const props = defineProps<{ question: TrainingQuestion }>()
type VoiceEvaluationControls = {
  success: (message?: string) => void
  retry: (message?: string) => void
}
type WordEval = {
  expectedText: string
  targetIndex: number
  tokenIndex?: number
  completesQuestion: boolean
}
const emit = defineEmits<{
  next: []
  voiceRecorded: [blob: Blob, controls: VoiceEvaluationControls, word: WordEval]
}>()

type SpeechState = 'waiting' | 'listening' | 'evaluating' | 'retry' | 'success' | 'denied'

const session = useTrainingSession()
const recorder = useVoiceRecorder()
const { recordVoiceIssue } = useDeveloperMode()
const { virtualEyeTrackerConnected } = useDeviceStatus()
const grid = ref<HTMLElement | null>(null)
const activeIndex = ref<number | null>(null)
const completedIds = ref<string[]>([])
const gazeIndex = ref<number | null>(null)
const gazePoint = ref({ x: 0, y: 0 })
const gazeVisible = ref(false)
const dwellProgress = ref(0)
const speechState = ref<SpeechState>('waiting')

let stateTimer: ReturnType<typeof setInterval> | null = null
let fallbackTimer: ReturnType<typeof setTimeout> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let dwellStartedAt = 0
let submittedBlob: Blob | null = null
let disposed = false

const items = computed<ReadingItem[]>(() => {
  if (props.question.readingItems?.length) return props.question.readingItems
  if (props.question.readingWords?.length) {
    return props.question.readingWords.map((word, index) => ({
      id: word.id,
      text: word.text,
      targetIndex: index,
    }))
  }
  // 레거시 목업(debug/치트) 경로: readingSentences/phraseChunks → 청크로 펼친다(실제 매퍼 경로와 동일).
  const chunks = props.question.readingSentences?.flatMap((sentence) => sentence.chunks)
    ?? props.question.phraseChunks
  if (chunks?.length) {
    return chunks.map((text, index) => ({ id: `reading-${index}`, text, targetIndex: index }))
  }
  const text = props.question.targetText?.trim()
  return text ? [{ id: `${props.question.id}-reading`, text, targetIndex: 0 }] : []
})
const layout = computed<'cards' | 'segments'>(() => {
  if (props.question.readingLayout) return props.question.readingLayout
  // 레거시 fallback: 낱말(readingWords)은 카드, 문장/구절(readingSentences/phraseChunks)은 세그먼트.
  if (props.question.readingWords?.length) return 'cards'
  return 'segments'
})
const singleItemNeedsWrapping = computed(() => {
  const text = items.value[0]?.text.trim() ?? ''
  return items.value.length === 1 && (text.length > 7 || /\s/.test(text))
})
const allComplete = computed(() => items.value.length > 0 && completedIds.value.length === items.value.length)
const isBusy = computed(() => speechState.value === 'listening' || speechState.value === 'evaluating')

const recordingMsFor = (wordIndex: number) => {
  const length = items.value[wordIndex]?.text.length ?? 2
  return Math.min(8_000, Math.max(3_000, length * 650 + 1_800))
}

const speechStatusText = computed(() => {
  switch (speechState.value) {
    case 'listening': return '말하는 중이에요!'
    case 'evaluating': return '확인 중이에요!'
    case 'retry': return retryMessage.value || '다시 읽어봐요!'
    case 'denied': return deniedMessage.value || '마이크를 켜 주세요'
    case 'success': return '잘 읽었어요!'
    default: return '읽을 낱말을 바라봐요'
  }
})

const stopSpeech = () => {
  if (fallbackTimer) {
    clearTimeout(fallbackTimer)
    fallbackTimer = null
  }
  recorder.stop()
}

// 단어 하나 통과 → 초록 체크. 마지막 단어면 세션에도 완료 기록.
const finishWord = (wordIndex: number, blob: Blob | null) => {
  stopSpeech()
  const word = items.value[wordIndex]
  if (word && !completedIds.value.includes(word.id)) {
    completedIds.value = [...completedIds.value, word.id]
  }
  if (allComplete.value) {
    session.markRecordingComplete({ audioUrl: null, blob: blob ?? undefined })
  }
  speechState.value = allComplete.value ? 'success' : 'waiting'
  activeIndex.value = null
  dwellStartedAt = 0
  dwellProgress.value = 0
}

const retryMessage = ref('')
const deniedMessage = ref('')

const setRetry = (wordIndex: number, message = '') => {
  stopSpeech()
  if (retryTimer) clearTimeout(retryTimer)
  retryMessage.value = message
  speechState.value = 'retry'
  retryTimer = setTimeout(() => void startSpeech(wordIndex), 1_100)
}

const startSpeech = async (wordIndex: number) => {
  if (disposed) return
  if (isBusy.value || speechState.value === 'success') return
  const word = items.value[wordIndex]
  if (!word || completedIds.value.includes(word.id)) return
  stopSpeech()
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  recorder.reset()
  submittedBlob = null
  activeIndex.value = wordIndex
  speechState.value = 'listening'

  await recorder.start()
  if (disposed) return
  if (recorder.state.status !== 'recording') {
    // 마이크가 아예 열리지 않으면 조용한 재시도 루프 대신 이유를 화면에 밝힌다.
    // (권한 거부·미지원 브라우저·다른 앱이 마이크 점유 등)
    stopSpeech()
    deniedMessage.value = recorder.state.errorMessage ?? '마이크를 켜 주세요'
    speechState.value = 'denied'
    activeIndex.value = null
    recordVoiceIssue(
      `마이크 시작 실패(${recorder.state.status}): ${deniedMessage.value}`,
      session.currentQuestionNumber.value,
      word.text,
    )
    return
  }
  // 낱말 하나 발화에 충분한 시간을 준 뒤 자동으로 녹음을 끝낸다.
  fallbackTimer = setTimeout(() => recorder.stop(), recordingMsFor(wordIndex))
}

// 녹음이 끝나면 해당 단어만 Azure 평가로 보낸다(부모 evaluateActivityVoice가 단어별 평가).
watch(() => recorder.state.status, (status) => {
  const blob = recorder.audioBlob.value
  if (status !== 'recorded' || !blob || blob === submittedBlob) return
  const wordIndex = activeIndex.value
  if (wordIndex === null) return
  const word = items.value[wordIndex]
  if (!word) return
  submittedBlob = blob
  speechState.value = 'evaluating'
  const completesQuestion = completedIds.value.length === items.value.length - 1
  emit('voiceRecorded', blob, {
    success: () => finishWord(wordIndex, blob),
    retry: (message) => setRetry(wordIndex, message),
  }, {
    expectedText: word.text,
    targetIndex: word.targetIndex,
    tokenIndex: word.tokenIndex,
    completesQuestion,
  })
})

const cardIndexAt = (clientX: number, clientY: number) => {
  const cards = grid.value?.querySelectorAll<HTMLElement>('.reading-target')
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
    detail: { clientX, clientY, tokenIndex, text },
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
  // 가상 아이트래커는 iread:gaze 이벤트로 시선을 보내므로 pointermove는 무시한다.
  // 커서 폴백이 꺼져 있으면(기본값) 마우스로 시선 히트를 만들지 않는다.
  if (virtualEyeTrackerConnected.value || !cursorGazeFallbackEnabled) return
  updateGaze(event.clientX, event.clientY, true)
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

watch(() => props.question.id, () => {
  stopSpeech()
  recorder.reset()
  submittedBlob = null
  activeIndex.value = null
  completedIds.value = []
  speechState.value = 'waiting'
  dwellStartedAt = 0
  dwellProgress.value = 0
})

onMounted(() => {
  window.addEventListener('iread:gaze', onGaze)
  // 시선 드웰: 응시한 미완료 카드 → 해당 단어 녹음 시작(녹음/평가 중에는 무시).
  stateTimer = setInterval(() => {
    if (disposed || allComplete.value || isBusy.value || speechState.value === 'success') return
    const idx = gazeIndex.value
    if (idx === null) {
      dwellStartedAt = 0
      dwellProgress.value = 0
      return
    }
    const word = items.value[idx]
    if (!word || completedIds.value.includes(word.id)) {
      dwellStartedAt = 0
      dwellProgress.value = 0
      return
    }
    if (!dwellStartedAt) dwellStartedAt = Date.now()
    dwellProgress.value = Math.min(1, (Date.now() - dwellStartedAt) / 900)
    if (dwellProgress.value >= 1) {
      dwellStartedAt = 0
      dwellProgress.value = 0
      void startSpeech(idx)
    }
  }, 50)
})

onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('iread:gaze', onGaze)
  if (stateTimer) clearInterval(stateTimer)
  stopSpeech()
  if (retryTimer) clearTimeout(retryTimer)
})
</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <header class="activity-heading">
      <h1>{{ allComplete ? '다 읽었어!' : question.instruction }}</h1>
    </header>

    <div class="reading-layout" @pointermove="onPointerMove" @pointerleave="onPointerLeave">
      <div v-if="layout === 'segments'" ref="grid" class="reading-segments">
        <span
          v-for="(item, index) in items"
          :key="item.id"
          class="reading-segment reading-target"
          :class="{
            active: activeIndex === index,
            gazed: gazeIndex === index,
            complete: completedIds.includes(item.id),
          }"
        >{{ item.text }}</span>
      </div>
      <div
        v-else
        ref="grid"
        class="word-grid"
        :class="{
          'word-grid--single': items.length === 1,
          'word-grid--single-row': items.length <= 2,
          'word-grid--sentence': singleItemNeedsWrapping,
        }"
      >
        <article
          v-for="(item, index) in items"
          :key="item.id"
          class="word-card reading-target"
          :class="{
            active: activeIndex === index,
            gazed: gazeIndex === index,
            complete: completedIds.includes(item.id),
          }"
        >
          <img v-if="completedIds.includes(item.id)" class="complete-mark" :src="checkIcon" alt="읽기 완료" />
          <strong>{{ item.text }}</strong>
        </article>
      </div>

      <section
        class="speech-panel"
        :class="`speech-panel--${speechState}`"
        aria-live="polite"
      >
        <div class="mic-state" role="status" :aria-label="speechStatusText">
          <img :src="microphoneIcon" alt="" aria-hidden="true" />
        </div>
        <div class="speech-wave" :class="{ active: speechState === 'listening' }" aria-hidden="true">
          <i v-for="index in 9" :key="index"></i>
        </div>
        <strong>{{ speechStatusText }}</strong>
      </section>
    </div>

    <footer class="action-bar">
      <button v-if="allComplete" class="next-button shared-next-source" type="button" @click="$emit('next')">다음</button>
    </footer>
  </section>
</template>

<style scoped src="@/styles/training/activities/WordReadingGridActivity.css"></style>
