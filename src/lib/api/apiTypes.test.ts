// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  hasResponseData,
  isErrorResponse,
  isSuccessResponse,
  type SuccessResponse,
} from './apiTypes'

describe('API 공통 응답 타입 guard', () => {
  it('data가 있는 성공 응답을 구분한다', () => {
    const response: SuccessResponse<{ id: number }> = {
      success: true,
      data: {
        id: 1,
      },
    }

    expect(isSuccessResponse(response)).toBe(true)
    expect(hasResponseData(response)).toBe(true)
  })

  it('data가 없는 성공 응답을 구분한다', () => {
    const response: SuccessResponse<never> = {
      success: true,
    }

    expect(isSuccessResponse(response)).toBe(true)
    expect(hasResponseData(response)).toBe(false)
  })

  it('error code와 message가 있는 오류 응답만 허용한다', () => {
    expect(
      isErrorResponse({
        error: {
          code: 'NOT_FOUND',
          message: '대상을 찾을 수 없습니다.',
        },
      }),
    ).toBe(true)
    expect(
      isErrorResponse({
        message: '잘못된 오류 형식',
      }),
    ).toBe(false)
  })
})
