import { describe, expect, it } from 'vitest'
import { isAbortError } from './isAbortError'

describe('isAbortError', () => {
  it('DOMException AbortError를 식별한다', () => {
    expect(isAbortError(new DOMException('요청 취소', 'AbortError'))).toBe(true)
  })

  it('AbortError 이름을 가진 Error와 직렬화된 오류를 식별한다', () => {
    const error = new Error('요청 취소')
    error.name = 'AbortError'

    expect(isAbortError(error)).toBe(true)
    expect(isAbortError({ name: 'AbortError' })).toBe(true)
  })

  it.each([null, undefined, 'AbortError', new Error('일반 오류'), { name: 'TimeoutError' }])(
    'Abort가 아닌 값은 false를 반환한다: %s',
    (value) => {
      expect(isAbortError(value)).toBe(false)
    },
  )
})
