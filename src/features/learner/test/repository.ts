import type { LearnerTrainingRepository } from '@/features/learner/training'

export type SkillChallengeTrackCode = 'phonological' | 'short-text' | 'fluency'

export interface LearnerSkillChallengeTrack {
  readonly trackCode: SkillChallengeTrackCode
  readonly title: string
  readonly status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  readonly completedQuestions: number
  readonly totalQuestions: number
  readonly nextTestId: string | null
}

export interface LearnerSkillChallengePlan {
  readonly testCurriculumId: string
  readonly completedQuestions: number
  readonly totalQuestions: number
  readonly completed: boolean
  readonly nextTestId: string | null
  readonly nextTrackCode: SkillChallengeTrackCode | null
  readonly tracks: readonly LearnerSkillChallengeTrack[]
}

export interface LearnerTestRepository extends LearnerTrainingRepository {
  readonly getChallengePlan: (studentId: string) => Promise<LearnerSkillChallengePlan>
}
