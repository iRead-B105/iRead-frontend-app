import { ApiLearnerContentRepository } from './apiLearnerContentRepository'
import type { LearnerContentRepository } from './repository'

export * from './apiLearnerContentRepository'
export * from './repository'

export const learnerContentRepository: LearnerContentRepository = new ApiLearnerContentRepository()
