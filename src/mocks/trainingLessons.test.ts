import { describe, expect, it } from 'vitest'
import {
  devPreviewLessons,
  devPreviewSourceLessonIds,
  getLessonById,
  lessonMap,
} from './trainingLessons'

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

  it('소리 바꾸기는 음절 바꾸기 훈련의 첫 문제만 보여준다', () => {
    const lesson = getLessonById('dev-preview-sound-manipulation')

    expect(lesson?.questions.map((question) => question.id)).toEqual([
      'dev-sound-manipulation-replace-syllable',
    ])
  })

  it('소리 빼기는 받침 빼기와 음절 빼기의 첫 문제만 한 번씩 보여준다', () => {
    const lesson = getLessonById('dev-preview-sound-omit')

    expect(lesson?.questions.map((question) => question.id)).toEqual([
      'dev-sound-omit-remove-batchim',
      'dev-sound-omit-sound-split',
    ])
  })

  it('읽기 훈련의 모든 난이도와 의미 유형을 하나의 읽기 화면으로 통합한다', () => {
    const lesson = getLessonById('dev-preview-word-reading-grid')

    expect(lesson?.questions.map((question) => question.id)).toEqual([
      'dev-word-reading-grid-read-real-words',
      'dev-word-reading-grid-read-batchim-words',
      'dev-word-reading-grid-read-nonwords',
      'dev-word-reading-grid-read-short-sentences',
      'dev-word-reading-grid-read-sentences',
      'dev-word-reading-grid-read-short-passage',
      'dev-word-reading-grid-follow-sentence',
      'dev-word-reading-grid-word-chain',
      'dev-word-reading-grid-phrase-reading',
      'dev-word-reading-grid-re-read',
      'dev-word-reading-grid-short-story',
      'dev-word-reading-grid-repeat-sentence',
    ])
  })

  it('치트 메뉴에서 목 학습 레슨을 빠짐없이 열 수 있다', () => {
    expect(new Set(devPreviewSourceLessonIds)).toEqual(new Set(Object.keys(lessonMap)))
  })
})
