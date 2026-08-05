/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LEARNER_DATA_SOURCE?: 'mock' | 'api'
  readonly VITE_API_BASE_URL?: string
  readonly VITE_BACKEND_URL?: string
  readonly VITE_GAZE_DEBUG_PANEL?: string
  readonly VITE_GAZE_WS_URL?: string
  readonly VITE_GAZE_MODE_URL?: string
}
