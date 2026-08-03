import { describe, expect, it } from 'vitest'
import { formatCurriculumStudyDate } from './curriculumStudyDate'

describe('formatCurriculumStudyDate', () => {
  const today = new Date(2026, 6, 30)

  it('서버에서 받은 학습 날짜를 월일로 표시한다', () => {
    expect(formatCurriculumStudyDate('2026-07-24', today)).toBe('7월 24일')
  })

  it('학습 날짜가 없으면 오늘 날짜를 표시한다', () => {
    expect(formatCurriculumStudyDate(null, today)).toBe('7월 30일')
  })

  it('학습 날짜가 잘못되어도 오늘 날짜를 표시한다', () => {
    expect(formatCurriculumStudyDate('2026-02-31', today)).toBe('7월 30일')
  })
})
