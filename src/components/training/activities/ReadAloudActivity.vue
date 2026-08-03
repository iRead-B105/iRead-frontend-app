<script setup lang="ts">
// 액티비티: 문장 따라 읽기 (유창성)
// 모범 음성을 듣고 마이크로 따라 읽어요.
// MediaRecorder 를 지원하면 실제 녹음, 미지원/권한거부 시 "목업 녹음"으로 동작합니다.
// 본 화면은 발음 평가/STT 점수를 표시하지 않으며, "연습 기록만 저장된다"고 안내합니다.
// 다음 레슨 이동은 상위가 처리합니다.

import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import type { TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import { mockVoiceSubmissionsEnabled } from '@/features/learner/training/mockDeviceSubmissions'
import SoundButton from '../SoundButton.vue'
import microphoneIcon from '@/assets/icons/microphone.svg'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

const session = useTrainingSession()
const { progressState } = session
const { isPlaying, currentText } = useAudioPlayer()
const recorder = useVoiceRecorder()

const sentence = computed(() => props.question.targetText ?? '')
const chunks = computed(() => props.question.phraseChunks ?? [])
const isModelPlaying = computed(() => isPlaying.value && currentText.value === sentence.value)

const status = computed(() => recorder.state.status)
const isRecording = computed(() => status.value === 'recording')
const hasRecording = computed(() => recorder.state.hasRecording)
const isMock = computed(() => recorder.state.isMock)
const isAnswered = computed(() => progressState.isCurrentCorrect === true)
let automaticStartTimer: ReturnType<typeof setTimeout> | null = null
let automaticStopTimer: ReturnType<typeof setTimeout> | null = null

const clearAutomaticTimers = () => {
  if (automaticStartTimer) clearTimeout(automaticStartTimer)
  if (automaticStopTimer) clearTimeout(automaticStopTimer)
  automaticStartTimer = null
  automaticStopTimer = null
}

const startAutomaticRecording = async () => {
  if (isAnswered.value || isRecording.value) return
  if (mockVoiceSubmissionsEnabled) {
    automaticStopTimer = setTimeout(
      () => session.markRecordingComplete({ isMock: true, audioUrl: null }),
      250,
    )
    return
  }
  await recorder.start()
  if (recorder.state.status !== 'recording') return
  const recordingMs = Math.min(12_000, Math.max(3_000, sentence.value.length * 650 + 1_800))
  automaticStopTimer = setTimeout(() => recorder.stop(), recordingMs)
}

const scheduleAutomaticRecording = () => {
  clearAutomaticTimers()
  automaticStartTimer = setTimeout(() => void startAutomaticRecording(), 300)
}

// 녹음이 완료되면 세션에 목업 결과를 저장(정답 처리)하여 다음 버튼 활성화
watch(
  () => status.value,
  (next) => {
    if (next === 'recorded' && !isAnswered.value) {
      session.markRecordingComplete({
        isMock: recorder.state.isMock,
        audioUrl: recorder.audioUrl.value,
        blob: recorder.audioBlob.value,
      })
    }
  },
)

// 문제가 바뀌면 녹음 상태 초기화
watch(
  () => props.question.id,
  () => {
    clearAutomaticTimers()
    recorder.reset()
    progressState.isCurrentCorrect = null
    scheduleAutomaticRecording()
  },
)

onMounted(scheduleAutomaticRecording)
onBeforeUnmount(() => {
  clearAutomaticTimers()
  recorder.stop()
})

const formatTime = (ms: number): string => {
  const total = Math.floor(ms / 1000)
  const m = String(Math.floor(total / 60)).padStart(1, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

const micButtonLabel = computed(() => {
  switch (status.value) {
    case 'recording':
      return '목소리를 듣고 있어요'
    case 'requesting':
      return '마이크 권한을 확인하고 있어…'
    case 'recorded':
      return '목소리를 잘 들었어요'
    case 'denied':
      return '마이크 권한이 필요해요'
    case 'unsupported':
      return '녹음 준비가 됐어.'
    default:
      return '자동으로 마이크를 켜고 있어요'
  }
})
</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <div class="activity-main">
      <div class="instruction">
        <p class="instruction-main">{{ question.instruction }}</p>
        <p v-if="question.subInstruction" class="instruction-sub">{{ question.subInstruction }}</p>
      </div>

      <!-- 모범 문장 -->
      <div class="sentence-card" :class="{ playing: isModelPlaying }">
        <div class="sentence-chunks">
          <span v-for="(chunk, i) in chunks" :key="i" class="chunk">{{ chunk }}</span>
          <span v-if="chunks.length === 0" class="chunk">{{ sentence }}</span>
        </div>
      </div>

      <div class="reading-side">
        <div class="listen-panel">
          <SoundButton
            v-if="question.audioPromptEnabled === true"
            :text="sentence"
            label="모범 문장"
            size="medium"
            variant="primary"
          />
        </div>

        <!-- 녹음 영역 -->
        <div class="record-area">
        <!-- 목업 파형 -->
        <div class="waveform" :class="{ active: isRecording }" aria-hidden="true">
          <span
            v-for="(bar, i) in recorder.waveform.value"
            :key="i"
            class="wave-bar"
            :style="{ height: `${Math.max(8, bar * 100)}%` }"
          ></span>
        </div>

        <div
          class="mic-button"
          :class="{ recording: isRecording, recorded: hasRecording && !isRecording, denied: status === 'denied' }"
          role="status"
          :aria-label="micButtonLabel"
        >
          <img
            :src="microphoneIcon"
            alt=""
            aria-hidden="true"
          />
        </div>

        <p class="record-status">
          <span v-if="isRecording" class="timer">{{ formatTime(recorder.state.elapsedMs) }}</span>
          {{ micButtonLabel }}
        </p>

        <p v-if="status === 'denied'" class="denied-note">권한을 허용하면 녹음할 수 있어.</p>

        </div>
      </div>
    </div>

    <div class="action-bar">
      <button
        class="action action--primary shared-next-source"
        type="button"
        :disabled="!isAnswered"
        @click="$emit('next')"
      >
        다음 문제
      </button>
    </div>
  </section>
</template>

<style scoped src="@/styles/training/activities/ReadAloudActivity.css"></style>
