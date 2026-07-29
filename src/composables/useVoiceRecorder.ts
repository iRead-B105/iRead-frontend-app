// 음성 녹음 composable (목업용)
//
// 가능하면 브라우저 MediaRecorder 로 실제 녹음을 수행합니다.
// MediaRecorder/getUserMedia 를 지원하지 않거나 권한이 거부된 환경에서는
// 녹음을 시작하지 않고 공용 장치 상태를 연결 안 됨으로 변경합니다.
//
// 본 파일은 발음 평가/STT 점수 측정을 수행하지 않습니다.
// 녹음 결과는 목업 저장소에 Blob(또는 목업 표시)으로만 보관됩니다.

import { onScopeDispose, reactive, ref, shallowRef } from 'vue'
import type { RecordingState } from '@/types/training'
import { useDeviceStatus } from './useDeviceStatus'

const MAX_RECORDING_MS = 30_000 // 최대 녹음 시간(목업 안전장치)
const WAVEFORM_BARS = 28

const isMediaRecorderSupported = (): boolean =>
  typeof window !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  typeof navigator.mediaDevices !== 'undefined' &&
  typeof navigator.mediaDevices.getUserMedia === 'function' &&
  typeof window.MediaRecorder !== 'undefined'

const buildIdleWaveform = (): number[] => Array.from({ length: WAVEFORM_BARS }, () => 0.08)

export function useVoiceRecorder() {
  const { setMicrophoneState } = useDeviceStatus()
  const state = reactive<RecordingState>({
    status: 'idle',
    elapsedMs: 0,
    isMock: false,
    hasRecording: false,
    errorMessage: null,
  })

  const waveform = ref<number[]>(buildIdleWaveform())

  // 실제 녹음 스트림/레코더/타이머
  let mediaStream: MediaStream | null = null
  let mediaRecorder: MediaRecorder | null = null
  const chunks = shallowRef<Blob[]>([])
  const audioUrl = ref<string | null>(null)

  let elapsedTimer: ReturnType<typeof setInterval> | null = null
  let waveTimer: ReturnType<typeof setInterval> | null = null
  let startedAt = 0

  const clearTimers = (): void => {
    if (elapsedTimer !== null) {
      clearInterval(elapsedTimer)
      elapsedTimer = null
    }
    if (waveTimer !== null) {
      clearInterval(waveTimer)
      waveTimer = null
    }
  }

  const stopStream = (): void => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop())
      mediaStream = null
    }
    mediaRecorder = null
  }

  // 목업 파형 갱신(실제 음량 분석 아님)
  const animateMockWaveform = (): void => {
    waveform.value = Array.from({ length: WAVEFORM_BARS }, () => 0.25 + Math.random() * 0.7)
  }

  // 녹음 시작. 권한이 필요하면 요청하고, 미지원·권한 거부 시 학습을 차단합니다.
  const start = async (): Promise<void> => {
    if (state.status === 'recording' || state.status === 'requesting') return

    // 녹음을 다시 시작할 때 이전 결과는 초기화
    resetRecordingData()

    if (!isMediaRecorderSupported()) {
      state.status = 'unsupported'
      state.errorMessage = '마이크를 연결하고 다시 시작해 주세요.'
      setMicrophoneState({ available: false, active: false })
      return
    }

    state.status = 'requesting'
    state.errorMessage = null

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicrophoneState({ available: true, active: true })
      state.isMock = false
      state.status = 'recording'
      startedAt = Date.now()
      chunks.value = []

      mediaRecorder = new MediaRecorder(mediaStream)
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunks.value.push(event.data)
        }
      }
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks.value, { type: mediaRecorder?.mimeType || 'audio/webm' })
        if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
        audioUrl.value = URL.createObjectURL(blob)
        state.hasRecording = true
        state.status = 'recorded'
        setMicrophoneState({ active: false })
        stopStream()
        clearTimers()
      }

      mediaRecorder.start()
      startTimers(false)
      // 최대 녹음 시간 도달 시 자동 종료
      if (elapsedTimer) {
        setTimeout(() => {
          if (state.status === 'recording') stop()
        }, MAX_RECORDING_MS)
      }
    } catch (err) {
      state.status = err instanceof DOMException && err.name === 'NotAllowedError' ? 'denied' : 'unsupported'
      state.errorMessage = '마이크 권한이 필요해요. 권한을 허용해 주세요.'
      setMicrophoneState({ available: false, active: false })
      stopStream()
    }
  }

  const startTimers = (isMock: boolean): void => {
    elapsedTimer = setInterval(() => {
      state.elapsedMs = Date.now() - startedAt
    }, 200)
    waveTimer = setInterval(() => {
      if (isMock) animateMockWaveform()
      else animateMockWaveform() // 목업 파형(실제 음량 미반영)
    }, 140)
  }

  // 녹음 종료
  const stop = (): void => {
    if (state.status !== 'recording') return
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop() // onstop 에서 상태 정리
      return
    }
    // 목업 모드 종료
    state.hasRecording = true
    state.status = 'recorded'
    setMicrophoneState({ active: false })
    clearTimers()
  }

  // 녹음 결과만 초기화(다시 녹음)
  const resetRecordingData = (): void => {
    if (audioUrl.value) {
      URL.revokeObjectURL(audioUrl.value)
      audioUrl.value = null
    }
    chunks.value = []
    state.elapsedMs = 0
    state.hasRecording = false
    waveform.value = buildIdleWaveform()
  }

  // 완전 초기화(문제 이동 시)
  const reset = (): void => {
    clearTimers()
    stopStream()
    resetRecordingData()
    state.status = 'idle'
    state.isMock = false
    state.errorMessage = null
  }

  // 컴포넌트 언마운트 시 리소스 정리
  onScopeDispose(() => {
    setMicrophoneState({ active: false })
    reset()
  })

  return {
    state,
    waveform,
    audioUrl,
    start,
    stop,
    reset,
  }
}
