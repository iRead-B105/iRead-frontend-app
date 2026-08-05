import { ApiLearnerGazeRepository } from './apiLearnerGazeRepository'
import type { LearnerGazeRepository } from './repository'

export * from './apiLearnerGazeRepository'
export * from './repository'

export const learnerGazeRepository: LearnerGazeRepository = new ApiLearnerGazeRepository()
