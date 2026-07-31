/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LEARNER_DATA_SOURCE?: 'mock' | 'api'
  readonly VITE_API_BASE_URL?: string
  readonly VITE_BACKEND_URL?: string
  readonly VITE_MOCK_DEVICE_SUBMISSIONS?: string
  readonly VITE_MOCK_VOICE_SUBMISSIONS?: string
  readonly VITE_MOCK_GAZE_SUBMISSIONS?: string
  readonly VITE_GAZE_DEBUG_PANEL?: string
}
