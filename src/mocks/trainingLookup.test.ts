import { describe, expect, it } from 'vitest'
import { findLessonSummary } from './trainingLookup'

describe('trainingLookup', () => {
  it('keeps backend curriculum lessons that are playable but omitted from the category menu', () => {
    expect(findLessonSummary('short-text', 'hard-word')).toMatchObject({
      id: 'hard-word',
      categoryId: 'short-text',
      activityType: 'word-reading-grid',
    })
    expect(findLessonSummary('fluency', 'read-short-passage')).toMatchObject({
      id: 'read-short-passage',
      categoryId: 'fluency',
      activityType: 'word-reading-grid',
    })
  })
})
