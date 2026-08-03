export type LearnerLearningEntryStatus =
  | 'CHALLENGE_REQUIRED'
  | 'CHALLENGE_IN_PROGRESS'
  | 'HOME'

export interface LearnerLearningEntry {
  readonly studentId: string
  readonly entryStatus: LearnerLearningEntryStatus
  readonly testCurriculumId: string | null
  readonly completedQuestions: number
  readonly totalQuestions: number
}

export interface LearnerStudentRepository {
  readonly source: 'mock' | 'api'
  readonly getLearningEntry: (studentId: string) => Promise<LearnerLearningEntry>
}
