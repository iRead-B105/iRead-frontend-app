import { describe, expect, it } from 'vitest'
import { getSkillChallengeLessons, useSkillChallenge } from './useSkillChallenge'

describe('useSkillChallenge 현재 영역별 완료 흐름', () => {
  it('선택한 한 영역의 마지막 문제 뒤에는 다른 영역으로 전환하지 않고 완료한다', () => {
    const challenge = useSkillChallenge()
    const lessons = getSkillChallengeLessons('phonological')
    expect(lessons.length).toBeGreaterThan(0)

    expect(challenge.startChallenge('phonological')).toEqual(lessons[0])
    let next = lessons[0] ?? null
    for (const lesson of lessons) {
      next = challenge.markLessonComplete(lesson.lessonId)
    }

    expect(next).toBeNull()
    expect(challenge.activeTrackId.value).toBe('phonological')
    expect(challenge.completedCount.value).toBe(lessons.length)
  })
})
