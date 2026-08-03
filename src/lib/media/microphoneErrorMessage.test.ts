import { describe, expect, it } from 'vitest'
import { resolveMicrophoneErrorMessage } from './microphoneErrorMessage'

describe('resolveMicrophoneErrorMessage', () => {
  it('마이크 권한 거부 오류를 사용자가 해결할 수 있는 안내로 바꾼다', () => {
    const error = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })

    expect(resolveMicrophoneErrorMessage(error)).toBe(
      '마이크 사용 권한이 꺼져 있어요.\n브라우저 설정에서 마이크 권한을 허용한 뒤 다시 시도해 주세요.',
    )
  })

  it('알 수 없는 오류에는 연결과 권한 확인 방법을 안내한다', () => {
    expect(resolveMicrophoneErrorMessage(new Error('unknown'))).toBe(
      '마이크 연결을 확인하지 못했어요. 마이크 연결과 브라우저 권한을 확인한 뒤 다시 시도해 주세요.',
    )
  })
})
