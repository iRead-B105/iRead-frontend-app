import { describe, expect, it } from 'vitest'
import { shouldCollectStoryGaze } from './storyGazeCollectionPolicy'

describe('story gaze collection policy', () => {
  it('아직 읽지 않은 페이지에서만 시선 데이터를 수집한다', () => {
    expect(shouldCollectStoryGaze(null)).toBe(true)
    expect(shouldCollectStoryGaze('2026-08-06T14:30:00+09:00')).toBe(false)
  })
})
