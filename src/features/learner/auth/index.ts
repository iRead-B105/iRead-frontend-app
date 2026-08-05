import { ApiLearnerAuthRepository } from './apiLearnerAuthRepository'
import type { LearnerAuthRepository } from './repository'

export * from './apiLearnerAuthRepository'
export * from './repository'
export * from './authenticatedProfileImage'

export const learnerAuthRepository: LearnerAuthRepository = new ApiLearnerAuthRepository()
