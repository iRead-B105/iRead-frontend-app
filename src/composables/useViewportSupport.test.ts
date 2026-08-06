import { describe, expect, it } from 'vitest'
import {
  MIN_VIEWPORT_HEIGHT,
  MIN_VIEWPORT_WIDTH,
  resolveUnsupportedReason,
  type ViewportConditions,
} from './useViewportSupport'

const conditions = (overrides: Partial<ViewportConditions> = {}): ViewportConditions => ({
  width: 1920,
  height: 1200,
  coarsePointer: false,
  hoverCapable: true,
  ...overrides,
})

describe('resolveUnsupportedReason', () => {
  it('학습용 PC 화면은 지원한다', () => {
    expect(resolveUnsupportedReason(conditions())).toBeNull()
  })

  it('휴대폰 세로 화면은 지원하지 않는다', () => {
    const reason = resolveUnsupportedReason(
      conditions({ width: 390, height: 844, coarsePointer: true, hoverCapable: false }),
    )

    expect(reason).toBe('touch-only')
  })

  it('휴대폰을 가로로 돌려 폭이 넓어져도 터치 전용이면 지원하지 않는다', () => {
    const reason = resolveUnsupportedReason(
      conditions({ width: 932, height: 430, coarsePointer: true, hoverCapable: false }),
    )

    expect(reason).toBe('touch-only')
  })

  it('마우스가 있는 작은 창은 크기 때문에 막는다', () => {
    const reason = resolveUnsupportedReason(
      conditions({ width: MIN_VIEWPORT_WIDTH - 1, height: 900 }),
    )

    expect(reason).toBe('viewport-too-small')
  })

  it('폭은 넉넉하지만 높이가 부족한 창도 막는다', () => {
    const reason = resolveUnsupportedReason(
      conditions({ height: MIN_VIEWPORT_HEIGHT - 1 }),
    )

    expect(reason).toBe('viewport-too-small')
  })

  it('최소 크기를 정확히 만족하면 지원한다', () => {
    const reason = resolveUnsupportedReason(
      conditions({ width: MIN_VIEWPORT_WIDTH, height: MIN_VIEWPORT_HEIGHT }),
    )

    expect(reason).toBeNull()
  })

  it('터치스크린 노트북은 hover 가 가능하므로 막지 않는다', () => {
    // 주 입력이 트랙패드면 pointer: fine 으로 보고된다. 그래도 hover 조건을 함께
    // 보게 해 두어야 터치가 달린 학습용 PC 를 잘못 막지 않는다.
    const reason = resolveUnsupportedReason(
      conditions({ coarsePointer: true, hoverCapable: true }),
    )

    expect(reason).toBeNull()
  })
})
