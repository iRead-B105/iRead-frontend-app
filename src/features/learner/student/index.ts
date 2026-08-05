import { ApiLearnerStudentRepository } from './apiLearnerStudentRepository'
import type { LearnerStudentRepository } from './repository'

export * from './apiLearnerStudentRepository'
export * from './repository'

export const learnerStudentRepository: LearnerStudentRepository = new ApiLearnerStudentRepository()
