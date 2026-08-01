import type { LearnerStudentRepository } from './repository'

export class MockLearnerStudentRepository implements LearnerStudentRepository {
  readonly source = 'mock' as const

  async getLearningEntry(studentId: string) {
    return {
      studentId,
      entryStatus: 'CHALLENGE_REQUIRED' as const,
      testCurriculumId: null,
      completedQuestions: 0,
      totalQuestions: 9,
    }
  }
}
