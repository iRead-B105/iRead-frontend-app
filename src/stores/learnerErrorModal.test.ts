import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/lib/api'
import {
  resolveLearnerErrorName,
  useLearnerErrorModalStore,
} from './learnerErrorModal'

describe('learner error modal', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('알려진 API 오류는 짧은 오류명과 상세 메시지를 함께 표시한다', () => {
    expect(resolveLearnerErrorName(new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'fetch failed',
    }))).toBe('네트워크 연결 오류: fetch failed')
  })

  it('알 수 없는 API 오류도 코드 대신 상세 메시지를 표시한다', () => {
    expect(resolveLearnerErrorName(new ApiError({
      status: 500,
      code: 'CURRICULUM_LOAD_FAILED',
      message: 'failed',
    }))).toBe('failed')
  })

  it('열기와 닫기 상태를 관리한다', () => {
    const store = useLearnerErrorModalStore()

    store.show('마이크 오류')
    expect(store.visible).toBe(true)
    expect(store.errorName).toBe('마이크 오류')

    store.close()
    expect(store.visible).toBe(false)
    expect(store.errorName).toBe('')
  })
})
