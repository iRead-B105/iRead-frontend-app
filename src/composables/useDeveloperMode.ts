import { readonly, ref } from 'vue'

const STORAGE_KEY = 'iread:developer-mode'
const CLICK_WINDOW_MS = 1_500
const REQUIRED_CLICKS = 5

const readInitialState = () => {
  if (typeof window === 'undefined' || !window.localStorage) return false
  return window.localStorage.getItem(STORAGE_KEY) === 'on'
}

const enabled = ref(readInitialState())
const latestVoiceScore = ref<DeveloperVoiceScore | null>(null)
let logoClicks = 0
let clickResetTimer: number | undefined

export interface DeveloperVoiceScore {
  readonly score: number
  readonly threshold: number
  readonly passed: boolean
  readonly canRetry: boolean
  readonly expectedText: string
  readonly questionNumber: number
}

export interface DevGazeLogEntry {
  readonly text: string
  readonly clientX: number
  readonly clientY: number
  readonly questionNumber: number
  readonly tokenIndex: number
  readonly capturedAt: string
}

export interface DevVoiceLogEntry extends DeveloperVoiceScore {
  readonly capturedAt: string
  // 평가 결과가 아니라 파이프라인 오류(마이크 실패·저장 실패 등)를 기록한 항목.
  readonly issue?: string
}

// DEV 로그: 시선 단어 히트 + 음성 정답/정확도 결과를 최근 DEV_LOG_CAP개까지 보관.
const devGazeLog = ref<DevGazeLogEntry[]>([])
const devVoiceLog = ref<DevVoiceLogEntry[]>([])
const DEV_LOG_CAP = 30

const setEnabled = (value: boolean) => {
  enabled.value = value
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off')
  }
  if (!value) {
    latestVoiceScore.value = null
    clearDevLogs()
  }
}

const toggle = () => setEnabled(!enabled.value)

const registerLogoClick = () => {
  // 패키징(일렉트론) 앱에서도 로고 5연타로 개발자 모드를 열 수 있어야 하므로
  // 프로덕션 가드를 두지 않는다. 1.5초 내 5연타가 진입 장벽 역할을 한다.
  logoClicks += 1
  if (clickResetTimer !== undefined) window.clearTimeout(clickResetTimer)

  if (logoClicks >= REQUIRED_CLICKS) {
    logoClicks = 0
    toggle()
    return true
  }

  clickResetTimer = window.setTimeout(() => {
    logoClicks = 0
    clickResetTimer = undefined
  }, CLICK_WINDOW_MS)
  return false
}

// 음성 파이프라인이 평가에 도달하지 못한 이유를 로그에 남긴다(같은 증상 재발 시 원인 식별용).
const recordVoiceIssue = (issue: string, questionNumber: number, expectedText = '') => {
  devVoiceLog.value = [
    {
      score: 0,
      threshold: 0,
      passed: false,
      canRetry: true,
      expectedText,
      questionNumber,
      issue,
      capturedAt: new Date().toLocaleTimeString(),
    },
    ...devVoiceLog.value,
  ].slice(0, DEV_LOG_CAP)
}

const recordVoiceScore = (score: DeveloperVoiceScore) => {
  latestVoiceScore.value = score
  devVoiceLog.value = [
    { ...score, capturedAt: new Date().toLocaleTimeString() },
    ...devVoiceLog.value,
  ].slice(0, DEV_LOG_CAP)
}

const clearVoiceScore = () => {
  latestVoiceScore.value = null
}

const pushDevGaze = (entry: Omit<DevGazeLogEntry, 'capturedAt'> & { capturedAt?: string }) => {
  devGazeLog.value = [
    { ...entry, capturedAt: entry.capturedAt ?? new Date().toLocaleTimeString() },
    ...devGazeLog.value,
  ].slice(0, DEV_LOG_CAP)
}

function clearDevLogs() {
  devGazeLog.value = []
  devVoiceLog.value = []
}

export const useDeveloperMode = () => ({
  enabled: readonly(enabled),
  latestVoiceScore: readonly(latestVoiceScore),
  devGazeLog: readonly(devGazeLog),
  devVoiceLog: readonly(devVoiceLog),
  setEnabled,
  toggle,
  registerLogoClick,
  recordVoiceScore,
  recordVoiceIssue,
  clearVoiceScore,
  pushDevGaze,
  clearDevLogs,
})
