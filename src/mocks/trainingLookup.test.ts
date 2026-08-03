import { describe, expect, it } from 'vitest'
import { findLessonSummary } from './trainingLookup'

describe('trainingLookup', () => {
  it('omits retired lessons while keeping playable backend-only lessons', () => {
    expect(findLessonSummary('short-text', 'hard-word')).toBeNull()
    expect(findLessonSummary('fluency', 'read-short-passage')).toMatchObject({
      id: 'read-short-passage',
      categoryId: 'fluency',
      activityType: 'word-reading-grid',
    })
  })
})
