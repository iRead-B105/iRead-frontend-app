import { defineStore } from 'pinia'
import { ApiError } from '@/lib/api'

const FRIENDLY_ERROR_NAMES: Readonly<Record<string, string>> = {
  NETWORK_ERROR: '네트워크 연결 오류',
  UNAUTHORIZED: '로그인 오류',
  INVALID_REFRESH_TOKEN: '로그인 만료',
  FORBIDDEN: '접근 권한 오류',
  INVALID_RESPONSE: '서버 응답 오류',
}

const FRIENDLY_RUNTIME_ERROR_NAMES: Readonly<Record<string, string>> = {
  NotAllowedError: '브라우저 사용 권한이 꺼져 있어요. 설정에서 필요한 권한을 허용한 뒤 다시 시도해 주세요.',
  TypeError: '훈련을 처리하는 중 문제가 생겼어요.\n잠시 후 다시 시도해 주세요.',
}

export function resolveLearnerErrorName(error: unknown, fallback = '알 수 없는 오류'): string {
  if (error instanceof ApiError) {
    const message = error.message.trim()
    const friendlyName = FRIENDLY_ERROR_NAMES[error.code]
    if (friendlyName && message) return `${friendlyName}: ${message}`
    return message || friendlyName || error.code
  }

  if (error instanceof Error) {
    return FRIENDLY_RUNTIME_ERROR_NAMES[error.name]
      || fallback
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
