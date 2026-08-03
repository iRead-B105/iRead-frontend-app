import { readonly, ref } from 'vue'

const STORAGE_KEY = 'iread:developer-mode'
const CLICK_WINDOW_MS = 1_500
const REQUIRED_CLICKS = 5

const readInitialState = () => {
  if (typeof window === 'undefined') return false
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

const setEnabled = (value: boolean) => {
  enabled.value = value
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off')
  }
  if (!value) latestVoiceScore.value = null
}

const toggle = () => setEnabled(!enabled.value)

const registerLogoClick = () => {
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

const recordVoiceScore = (score: DeveloperVoiceScore) => {
  latestVoiceScore.value = score
}

const clearVoiceScore = () => {
  latestVoiceScore.value = null
}

export const useDeveloperMode = () => ({
  enabled: readonly(enabled),
  latestVoiceScore: readonly(latestVoiceScore),
  setEnabled,
  toggle,
  registerLogoClick,
  recordVoiceScore,
  clearVoiceScore,
})
