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

  it('브라우저 권한 오류의 기술명을 사용자 안내로 바꾼다', () => {
    const error = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })

    expect(resolveLearnerErrorName(error)).toBe(
      '브라우저 사용 권한이 꺼져 있어요. 설정에서 필요한 권한을 허용한 뒤 다시 시도해 주세요.',
    )
  })

  it('TypeError 기술명을 아동이 이해할 수 있는 안내로 바꾼다', () => {
    expect(resolveLearnerErrorName(new TypeError('internal details'))).toBe(
      '훈련을 처리하는 중 문제가 생겼어요.\n잠시 후 다시 시도해 주세요.',
    )
  })

  it('알려지지 않은 예외는 기술 정보 대신 화면별 안내를 표시한다', () => {
    expect(resolveLearnerErrorName(
      Object.assign(new Error('internal details'), { name: 'UnknownRuntimeError' }),
      '훈련 제출 오류',
    )).toBe('훈련 제출 오류')
  })
})
