import { ApiLearnerTrainingRepository } from './apiLearnerTrainingRepository'
import type { LearnerTrainingRepository } from './repository'

export * from './apiLearnerTrainingRepository'
export * from './repository'
export * from './trainingQuestionMapper'

export const learnerTrainingRepository: LearnerTrainingRepository = new ApiLearnerTrainingRepository()
