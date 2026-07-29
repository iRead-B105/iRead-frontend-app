import { learnerDataSource } from '@/config/learnerDataSource'
import { ApiLearnerStoryRepository } from './apiLearnerStoryRepository'
import { MockLearnerStoryRepository } from './mockLearnerStoryRepository'
import type { LearnerStoryRepository } from './repository'

export * from './apiLearnerStoryRepository'
export * from './mockLearnerStoryRepository'
export * from './repository'

export const learnerStoryRepository: LearnerStoryRepository =
  learnerDataSource === 'api'
    ? new ApiLearnerStoryRepository()
    : new MockLearnerStoryRepository()
