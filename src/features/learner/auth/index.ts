import { learnerDataSource } from '@/config/learnerDataSource'
import { ApiLearnerAuthRepository } from './apiLearnerAuthRepository'
import { MockLearnerAuthRepository } from './mockLearnerAuthRepository'
import type { LearnerAuthRepository } from './repository'

export * from './apiLearnerAuthRepository'
export * from './mockLearnerAuthRepository'
export * from './repository'
export * from './authenticatedProfileImage'

export function createLearnerAuthRepository(
  source: 'mock' | 'api',
): LearnerAuthRepository {
  return source === 'api'
    ? new ApiLearnerAuthRepository()
    : new MockLearnerAuthRepository()
}

export const learnerAuthRepository = createLearnerAuthRepository(learnerDataSource)
