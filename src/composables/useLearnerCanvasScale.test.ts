import { describe, expect, it } from 'vitest'
import {
  LEARNER_CANVAS_HEIGHT,
  LEARNER_CANVAS_WIDTH,
  calculateLearnerCanvasScale,
} from './useLearnerCanvasScale'

describe('학습자 고정 캔버스 배율', () => {
  it('기준 해상도에서는 원본 크기를 유지한다', () => {
    expect(calculateLearnerCanvasScale(
      LEARNER_CANVAS_WIDTH,
      LEARNER_CANVAS_HEIGHT,
    )).toBe(1)
  })

  it('노트북 F11과 같은 16:10 비율에서는 모든 요소를 같은 비율로 축소·확대한다', () => {
    expect(calculateLearnerCanvasScale(1280, 800)).toBeCloseTo(2 / 3)
    expect(calculateLearnerCanvasScale(2560, 1600)).toBeCloseTo(4 / 3)
  })

  it('비율이 다른 화면에서는 잘리지 않는 축을 기준으로 맞춘다', () => {
    expect(calculateLearnerCanvasScale(1024, 768)).toBeCloseTo(1024 / 1920)
    expect(calculateLearnerCanvasScale(2560, 1200)).toBe(1)
  })
})
