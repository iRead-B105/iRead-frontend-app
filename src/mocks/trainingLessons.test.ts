import { describe, expect, it } from 'vitest'
import { devPreviewLessons, getLessonById } from './trainingLessons'

describe('DEV 훈련 화면 미리보기', () => {
  it('같은 화면을 쓰는 훈련을 화면 유형별 대표 레슨으로 묶는다', () => {
    expect(devPreviewLessons).toHaveLength(12)
    expect(new Set(devPreviewLessons.map((lesson) => lesson.activityType)).size).toBe(12)
    expect(new Set(devPreviewLessons.map((lesson) => lesson.id)).size).toBe(12)
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

  it('읽기 훈련은 낱말, 겹받침, 의미 없는 말, 짧은 문장 순서로 통합한다', () => {
    const lesson = getLessonById('dev-preview-word-reading-grid')

    expect(lesson?.questions.map((question) => question.id)).toEqual([
      'dev-word-reading-grid-read-real-words',
      'dev-word-reading-grid-read-batchim-words',
      'dev-word-reading-grid-read-nonwords',
      'dev-word-reading-grid-read-short-sentences',
    ])
  })
})
