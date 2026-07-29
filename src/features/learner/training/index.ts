import { learnerDataSource } from '@/config/learnerDataSource'
import { ApiLearnerTrainingRepository } from './apiLearnerTrainingRepository'
import { MockLearnerTrainingRepository } from './mockLearnerTrainingRepository'
import type { LearnerTrainingRepository } from './repository'

export * from './apiLearnerTrainingRepository'
export * from './mockLearnerTrainingRepository'
export * from './repository'
export * from './trainingQuestionMapper'

export function createLearnerTrainingRepository(
  source: 'mock' | 'api',
): LearnerTrainingRepository {
  return source === 'api'
    ? new ApiLearnerTrainingRepository()
    : new MockLearnerTrainingRepository()
}

export const learnerTrainingRepository = createLearnerTrainingRepository(learnerDataSource)
