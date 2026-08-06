// @vitest-environment jsdom

// 회귀 방지: 이야기 선택지를 누른 뒤 생성이 끝나기 전에 홈으로 나갔다 다시 들어오면
// 같은 분기의 선택지를 또 누를 수 있었다(같은 분기 생성 2회).

import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearStoryBranchPending,
  isStoryBranchPending,
  markStoryBranchPending,
} from './pendingBranch'

const NOW = 1_770_000_000_000

describe('진행 중인 이야기 분기 기록', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('선택한 분기는 진행 중으로 남아 화면 이동 뒤에도 알아본다', () => {
    markStoryBranchPending('101', '9', NOW)

    expect(isStoryBranchPending('101', '9', NOW + 1_000)).toBe(true)
  })

  it('다른 이야기나 다른 분기는 막지 않는다', () => {
    markStoryBranchPending('101', '9', NOW)

    expect(isStoryBranchPending('102', '9', NOW)).toBe(false)
    expect(isStoryBranchPending('101', '10', NOW)).toBe(false)
  })

  it('생성이 끝나면 기록을 지운다', () => {
    markStoryBranchPending('101', '9', NOW)
    clearStoryBranchPending()

    expect(isStoryBranchPending('101', '9', NOW)).toBe(false)
  })

  it('생성이 실패해 기록만 남아도 만료 뒤에는 분기를 풀어 준다', () => {
    markStoryBranchPending('101', '9', NOW)

    // AI 읽기 제한(210s)보다 넉넉한 5분을 넘긴 시점.
    expect(isStoryBranchPending('101', '9', NOW + 5 * 60 * 1000 + 1)).toBe(false)
    // 만료된 기록은 즉시 정리해 다음 조회에 남지 않는다.
    expect(window.sessionStorage.getItem('iread.learner.pendingStoryBranch')).toBeNull()
  })

  it('저장된 값이 깨져 있으면 진행 중으로 보지 않는다', () => {
    window.sessionStorage.setItem('iread.learner.pendingStoryBranch', 'not-json')

    expect(isStoryBranchPending('101', '9', NOW)).toBe(false)
  })

  it('기록이 없으면 선택지를 막지 않는다', () => {
    expect(isStoryBranchPending('101', '9', NOW)).toBe(false)
  })
})
