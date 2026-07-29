import { defineStore } from 'pinia'
import { ApiError } from '@/lib/api'

const FRIENDLY_ERROR_NAMES: Readonly<Record<string, string>> = {
  NETWORK_ERROR: '네트워크 연결 오류',
  UNAUTHORIZED: '로그인 오류',
  INVALID_REFRESH_TOKEN: '로그인 만료',
  FORBIDDEN: '접근 권한 오류',
  INVALID_RESPONSE: '서버 응답 오류',
}

export function resolveLearnerErrorName(error: unknown, fallback = '알 수 없는 오류'): string {
  if (error instanceof ApiError) {
    return FRIENDLY_ERROR_NAMES[error.code] ?? error.code
  }

  if (error instanceof Error) {
    return error.name && error.name !== 'Error' ? error.name : fallback
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim()
  }

  return fallback
}

export const useLearnerErrorModalStore = defineStore('learner-error-modal', {
  state: () => ({
    visible: false,
    errorName: '',
  }),

  actions: {
    show(error: unknown, fallback?: string) {
      this.errorName = resolveLearnerErrorName(error, fallback)
      this.visible = true
    },

    close() {
      this.visible = false
      this.errorName = ''
    },
  },
})
