import { describe, expect, it } from 'vitest'
import { presentTrainingHint } from './hintPresentation'

describe('presentTrainingHint', () => {
  it('카드형 훈련의 직접 힌트는 정답 글자 대신 시각 안내를 표시한다', () => {
    for (const activityType of [
      'audio-letter-choice',
      'listen-and-select',
      'sound-choice',
      'sound-manipulation',
    ] as const) {
      expect(
        presentTrainingHint(
          activityType,
          '정답은 ㅁ이에요. 정답대로 다시 해보세요.',
          2,
        ),
      ).toBe('반짝이는 정답 카드를 골라 다시 해봐요.')
    }
  })

  it('일반 훈련의 서버 힌트는 유지한다', () => {
    expect(
      presentTrainingHint('listen-and-select', '한 번 더 들어보세요.', 1),
    ).toBe('한 번 더 들어보세요.')
  })
})
