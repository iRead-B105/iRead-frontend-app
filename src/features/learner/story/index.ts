import { ApiLearnerStoryRepository } from './apiLearnerStoryRepository'
import type { LearnerStoryRepository } from './repository'

export * from './apiLearnerStoryRepository'
export * from './repository'

export const learnerStoryRepository: LearnerStoryRepository = new ApiLearnerStoryRepository()
