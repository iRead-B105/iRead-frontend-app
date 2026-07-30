<script setup lang="ts">
// 액티비티: 문장 따라 읽기 (유창성)
// 모범 음성을 듣고 마이크로 따라 읽어요.
// MediaRecorder 를 지원하면 실제 녹음, 미지원/권한거부 시 "목업 녹음"으로 동작합니다.
// 본 화면은 발음 평가/STT 점수를 표시하지 않으며, "연습 기록만 저장된다"고 안내합니다.
// 다음 레슨 이동은 상위가 처리합니다.

import { computed, watch } from 'vue'
import type { TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import SoundButton from '../SoundButton.vue'
import microphoneIcon from '@/assets/icons/microphone.svg'
import stopIcon from '@/assets/icons/stop.svg'
import checkIcon from '@/assets/icons/check.svg'

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

// 녹음이 완료되면 세션에 목업 결과를 저장(정답 처리)하여 다음 버튼 활성화
watch(
  () => status.value,
  (next) => {
    if (next === 'recorded' && !isAnswered.value) {
      session.markRecordingComplete({
        isMock: recorder.state.isMock,
        audioUrl: recorder.audioUrl.value,
      })
    }
  },
)

// 문제가 바뀌면 녹음 상태 초기화
watch(
  () => props.question.id,
  () => {
    recorder.reset()
    progressState.isCurrentCorrect = null
  },
)

const handleMicToggle = () => {
  if (isRecording.value) {
    recorder.stop()
  } else {
    void recorder.start()
  }
}

const handleReRecord = () => {
  recorder.reset()
  progressState.isCurrentCorrect = null
}

const playMyRecording = () => {
  // 실제 녹음이 있으면 재생(목업이면 재생 불가)
  if (recorder.audioUrl.value) {
    const audio = new Audio(recorder.audioUrl.value)
    void audio.play()
  }
}

const formatTime = (ms: number): string => {
  const total = Math.floor(ms / 1000)
  const m = String(Math.floor(total / 60)).padStart(1, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

const micButtonLabel = computed(() => {
  switch (status.value) {
    case 'recording':
      return '녹음 중… 누르면 멈춰요'
    case 'requesting':
      return '마이크 권한을 확인하고 있어…'
    case 'recorded':
      return '녹음 완료! 다시 녹음하려면 눌러요'
    case 'denied':
      return '마이크 권한이 필요해. 다시 눌러서 허용해 줘.'
    case 'unsupported':
      return '녹음 준비가 됐어.'
    default:
      return '누르면 내 목소리를 녹음해'
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
        <SoundButton :text="sentence" label="모범 문장" size="medium" variant="primary" />
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

        <button
          class="mic-button"
          :class="{ recording: isRecording, recorded: hasRecording && !isRecording, denied: status === 'denied' }"
          type="button"
          :aria-label="micButtonLabel"
          @click="handleMicToggle"
        >
          <img
            :src="isRecording ? stopIcon : hasRecording ? checkIcon : microphoneIcon"
            alt=""
            aria-hidden="true"
          />
        </button>

        <p class="record-status">
          <span v-if="isRecording" class="timer">{{ formatTime(recorder.state.elapsedMs) }}</span>
          {{ micButtonLabel }}
        </p>

        <p v-if="status === 'denied'" class="denied-note">권한을 허용하면 녹음할 수 있어.</p>

        <!-- 녹음 후 액션 -->
        <div v-if="hasRecording && !isRecording" class="record-actions">
          <button v-if="!isMock" class="chip" type="button" @click="playMyRecording">내 녹음 듣기</button>
          <button class="chip" type="button" @click="handleReRecord">다시 녹음하기</button>
        </div>
      </div>
    </div>

    <div class="action-bar">
      <button
        class="action action--primary"
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
