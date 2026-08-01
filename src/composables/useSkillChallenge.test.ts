import { describe, expect, it } from 'vitest'
import { getSkillChallengeSequence, useSkillChallenge } from './useSkillChallenge'

describe('useSkillChallenge 전체 실력 도전 흐름', () => {
  it('영역 선택 없이 세 영역의 문제를 3개씩 총 9개 진행한다', () => {
    const challenge = useSkillChallenge()
    const lessons = getSkillChallengeSequence()
    expect(lessons).toHaveLength(9)
    expect(lessons.map((lesson) => lesson.trackId)).toEqual([
      'phonological', 'phonological', 'phonological',
      'short-text', 'short-text', 'short-text',
      'fluency', 'fluency', 'fluency',
    ])

    expect(challenge.startChallenge()).toEqual(lessons[0])
    let next = lessons[0] ?? null
    for (const lesson of lessons) {
      next = challenge.markLessonComplete(lesson.lessonId, lesson.trackId)
    }

    expect(next).toBeNull()
    expect(challenge.activeTrackId.value).toBe('fluency')
    expect(challenge.completedCount.value).toBe(lessons.length)
  })
})
