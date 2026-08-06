// 음성 녹음 composable
//
// 브라우저 MediaRecorder 로 실제 녹음을 수행합니다.
// MediaRecorder/getUserMedia 를 지원하지 않거나 권한이 거부된 환경에서는
// 녹음을 시작하지 않고 공용 장치 상태를 연결 안 됨으로 변경합니다.
//
// 본 파일은 발음 평가/STT 점수 측정을 수행하지 않습니다.
// 녹음 결과는 Blob으로만 보관되며, 평가는 상위 화면이 백엔드로 제출합니다.

import { onScopeDispose, reactive, ref, shallowRef } from 'vue'
import type { RecordingState } from '@/types/training'
import {
  MICROPHONE_PERMISSION_DENIED_MESSAGE,
  resolveMicrophoneErrorMessage,
} from '@/lib/media/microphoneErrorMessage'
import {
  watchMicrophonePermission,
  type MicrophonePermission,
} from '@/lib/media/microphonePermission'
import { useDeviceStatus } from './useDeviceStatus'

const MAX_RECORDING_MS = 30_000 // 최대 녹음 시간(안전장치)
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
    hasRecording: false,
    errorMessage: null,
  })

  const waveform = ref<number[]>(buildIdleWaveform())
  const permission = ref<MicrophonePermission>('unsupported')
  const hasDetectedVoice = ref(false)
  const voiceActivityDetectionAvailable = ref(false)
  // 마지막으로 음성 에너지가 감지된 시각. 발화 후 침묵을 감지해 녹음을
  // 일찍 끝내려는 화면(문장 따라 읽기 등)이 참조한다.
  const lastVoiceActivityAt = ref<number | null>(null)

  // 실제 녹음 스트림/레코더/타이머
  let mediaStream: MediaStream | null = null
  let mediaRecorder: MediaRecorder | null = null
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let analyserData: Uint8Array<ArrayBuffer> | null = null
  let detectedVoiceFrames = 0
  const chunks = shallowRef<Blob[]>([])
  const audioBlob = shallowRef<Blob | null>(null)
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
    analyser?.disconnect()
    analyser = null
    analyserData = null
    if (audioContext) void audioContext.close()
    audioContext = null
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop())
      mediaStream = null
    }
    mediaRecorder = null
  }

  const startVoiceActivityDetection = (stream: MediaStream): void => {
    if (typeof window.AudioContext === 'undefined') {
      // 분석 API가 없는 환경에서는 기존 녹음 동작을 유지한다.
      hasDetectedVoice.value = true
      return
    }

    audioContext = new AudioContext()
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.65
    analyserData = new Uint8Array(analyser.fftSize)
    audioContext.createMediaStreamSource(stream).connect(analyser)
    voiceActivityDetectionAvailable.value = true
  }

  const updateVoiceActivity = (): void => {
    if (!analyser || !analyserData) return
    analyser.getByteTimeDomainData(analyserData)
    let energy = 0
    for (const sample of analyserData) {
      const normalized = (sample - 128) / 128
      energy += normalized * normalized
    }
    const rms = Math.sqrt(energy / analyserData.length)
    const level = Math.min(1, rms * 8)
    waveform.value = Array.from(
      { length: WAVEFORM_BARS },
      (_, index) => Math.max(0.08, level * (0.72 + (index % 4) * 0.09)),
    )

    detectedVoiceFrames = rms >= 0.015
      ? detectedVoiceFrames + 1
      : Math.max(0, detectedVoiceFrames - 1)
    if (rms >= 0.015) lastVoiceActivityAt.value = Date.now()
    if (detectedVoiceFrames >= 2) hasDetectedVoice.value = true
  }

  const checkAccess = async (): Promise<boolean> => {
    reset()
    if (!isMediaRecorderSupported()) {
      state.status = 'unsupported'
      state.errorMessage = '이 브라우저에서는 음성 녹음 기능을 사용할 수 없어요.'
      setMicrophoneState({ available: false, active: false })
      return false
    }

    state.status = 'requesting'
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      state.status = 'idle'
      state.errorMessage = null
      setMicrophoneState({ available: true, active: false })
      return true
    } catch (error) {
      state.status = error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'denied'
        : 'unsupported'
      state.errorMessage = resolveMicrophoneErrorMessage(error)
      setMicrophoneState({ available: false, active: false })
      return false
    }
  }

  // 녹음 시작. 권한이 필요하면 요청하고, 미지원·권한 거부 시 학습을 차단합니다.
  const start = async (): Promise<void> => {
    if (state.status === 'recording' || state.status === 'requesting') return

    // 녹음을 다시 시작할 때 이전 결과는 초기화
    resetRecordingData()

    if (!isMediaRecorderSupported()) {
      state.status = 'unsupported'
      state.errorMessage = '이 브라우저에서는 음성 녹음 기능을 사용할 수 없어요.'
      setMicrophoneState({ available: false, active: false })
      return
    }

    state.status = 'requesting'
    state.errorMessage = null

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      startVoiceActivityDetection(mediaStream)
      setMicrophoneState({ available: true, active: true })
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
        audioBlob.value = blob
        if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
        audioUrl.value = URL.createObjectURL(blob)
        state.hasRecording = true
        state.status = 'recorded'
        setMicrophoneState({ active: false })
        stopStream()
        clearTimers()
      }

      mediaRecorder.start()
      startTimers()
      // 최대 녹음 시간 도달 시 자동 종료
      if (elapsedTimer) {
        setTimeout(() => {
          if (state.status === 'recording') stop()
        }, MAX_RECORDING_MS)
      }
    } catch (err) {
      state.status = err instanceof DOMException && err.name === 'NotAllowedError' ? 'denied' : 'unsupported'
      state.errorMessage = resolveMicrophoneErrorMessage(err)
      setMicrophoneState({ available: false, active: false })
      stopStream()
    }
  }

  const startTimers = (): void => {
    elapsedTimer = setInterval(() => {
      state.elapsedMs = Date.now() - startedAt
    }, 200)
    waveTimer = setInterval(() => updateVoiceActivity(), 140)
  }

  // 녹음 종료
  const stop = (): void => {
    if (state.status !== 'recording') return
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop() // onstop 에서 상태 정리
      return
    }
    // 레코더가 이미 정리된 경우의 방어적 마무리
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
    audioBlob.value = null
    state.elapsedMs = 0
    state.hasRecording = false
    hasDetectedVoice.value = false
    voiceActivityDetectionAvailable.value = false
    lastVoiceActivityAt.value = null
    detectedVoiceFrames = 0
    waveform.value = buildIdleWaveform()
  }

  // 완전 초기화(문제 이동 시)
  const reset = (): void => {
    clearTimers()
    stopStream()
    resetRecordingData()
    state.status = 'idle'
    state.errorMessage = null
  }

  // 브라우저 권한이 바뀌면 남아 있던 거부 안내를 스스로 걷어낸다.
  //
  // 권한을 껐다가 다시 허용해도 status='denied' 와 errorMessage 가 그대로 남아
  // "마이크 사용 권한이 꺼져 있어요" 안내가 사라지지 않았다. 다음 녹음 시도가
  // 있을 때까지 알 방법이 없었기 때문이다.
  const stopPermissionWatch = watchMicrophonePermission((next) => {
    permission.value = next
    if (next === 'unsupported') return

    if (next === 'granted') {
      if (state.status === 'denied') {
        state.status = 'idle'
        state.errorMessage = null
      }
      return
    }

    // 녹음 중에 권한이 끊기면 진행 중인 녹음도 정리해야 한다.
    if (state.status === 'recording' || state.status === 'requesting') {
      clearTimers()
      stopStream()
    }
    if (next === 'denied' && state.status !== 'recorded') {
      state.status = 'denied'
      state.errorMessage = MICROPHONE_PERMISSION_DENIED_MESSAGE
      setMicrophoneState({ available: false, active: false })
    }
  })

  // 컴포넌트 언마운트 시 리소스 정리
  onScopeDispose(() => {
    stopPermissionWatch()
    setMicrophoneState({ active: false })
    reset()
  })

  return {
    state,
    waveform,
    permission,
    audioUrl,
    audioBlob,
    hasDetectedVoice,
    lastVoiceActivityAt,
    voiceActivityDetectionAvailable,
    checkAccess,
    start,
    stop,
    reset,
  }
}
