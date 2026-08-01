import { learnerDataSource } from '@/config/learnerDataSource'
import { ApiLearnerStudentRepository } from './apiLearnerStudentRepository'
import { MockLearnerStudentRepository } from './mockLearnerStudentRepository'
import type { LearnerStudentRepository } from './repository'

export * from './apiLearnerStudentRepository'
export * from './mockLearnerStudentRepository'
export * from './repository'

export function createLearnerStudentRepository(
  source: 'mock' | 'api',
): LearnerStudentRepository {
  return source === 'api'
    ? new ApiLearnerStudentRepository()
    : new MockLearnerStudentRepository()
}

export const learnerStudentRepository = createLearnerStudentRepository(learnerDataSource)
