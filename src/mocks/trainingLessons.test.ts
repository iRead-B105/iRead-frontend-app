import { describe, expect, it } from 'vitest'
import { devPreviewLessons, getLessonById } from './trainingLessons'

describe('DEV 훈련 화면 미리보기', () => {
  it('같은 화면을 쓰는 훈련을 화면 유형별 대표 레슨으로 묶는다', () => {
    expect(devPreviewLessons).toHaveLength(16)
    expect(new Set(devPreviewLessons.map((lesson) => lesson.activityType)).size).toBe(16)
    expect(new Set(devPreviewLessons.map((lesson) => lesson.id)).size).toBe(16)
  })

  it('따라 보기는 자음, 모음, 글자 순서로 대표 문항 하나씩 보여준다', () => {
    const lesson = getLessonById('dev-preview-gaze-trace')

    expect(lesson?.questions.map((question) => question.id)).toEqual([
      'dev-gaze-trace-trace-consonant',
      'dev-gaze-trace-trace-vowel',
      'dev-gaze-trace-trace-syllable',
    ])
  })

  it('소리 빼기와 바꾸기는 각 훈련의 첫 문제만 한 번씩 보여준다', () => {
    const lesson = getLessonById('dev-preview-sound-manipulation')

    expect(lesson?.questions.map((question) => question.id)).toEqual([
      'dev-sound-manipulation-remove-batchim',
      'dev-sound-manipulation-remove-syllable',
      'dev-sound-manipulation-replace-syllable',
    ])
  })
})
