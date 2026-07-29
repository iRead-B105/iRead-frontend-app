import { learnerDataSource } from '@/config/learnerDataSource'
import { ApiLearnerGazeRepository } from './apiLearnerGazeRepository'
import { MockLearnerGazeRepository } from './mockLearnerGazeRepository'
import type { LearnerGazeRepository } from './repository'

export * from './apiLearnerGazeRepository'
export * from './mockLearnerGazeRepository'
export * from './repository'

export const learnerGazeRepository: LearnerGazeRepository =
  learnerDataSource === 'api'
    ? new ApiLearnerGazeRepository()
    : new MockLearnerGazeRepository()
