import { learnerDataSource } from '@/config/learnerDataSource'
import { ApiLearnerContentRepository } from './apiLearnerContentRepository'
import { MockLearnerContentRepository } from './mockLearnerContentRepository'
import type { LearnerContentRepository } from './repository'

export * from './apiLearnerContentRepository'
export * from './mockLearnerContentRepository'
export * from './repository'

export function createLearnerContentRepository(
  source: 'mock' | 'api',
): LearnerContentRepository {
  return source === 'api'
    ? new ApiLearnerContentRepository()
    : new MockLearnerContentRepository()
}

export const learnerContentRepository = createLearnerContentRepository(learnerDataSource)
