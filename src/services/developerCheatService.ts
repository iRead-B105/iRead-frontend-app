import { learnerApiClient } from '@/features/learner/learnerApiClient'

export interface DeveloperCheatResult {
  readonly action: 'RESET_PROGRESS' | 'ADVANCE_TO_NEXT_DAY'
  readonly curriculumId: number
  readonly curriculumStatus: string
  readonly trainingCount: number
}

export interface DeveloperTrainingAdvanceResult {
  readonly action: 'ADVANCE_TO_NEXT_TRAINING'
  readonly curriculumId: number
  readonly curriculumStatus: string
  readonly completedTrainingId: number
  readonly completedTrainingStatus: 'COMPLETED'
  readonly nextTrainingId: number
  readonly nextTrainingStatus: 'NOT_STARTED' | 'IN_PROGRESS'
}

export const resetDemoLearningProgress = (studentId: string): Promise<DeveloperCheatResult> =>
  learnerApiClient.request(`/api/app/dev/${studentId}/learning/reset`, { method: 'POST' })

export const advanceDemoLearningDay = (studentId: string): Promise<DeveloperCheatResult> =>
  learnerApiClient.request(`/api/app/dev/${studentId}/learning/next-day`, { method: 'POST' })

export const advanceToNextDemoTraining = (
  studentId: string,
  trainingId: string,
): Promise<DeveloperTrainingAdvanceResult> =>
  learnerApiClient.request(
    `/api/app/dev/${studentId}/learning/trainings/${trainingId}/next`,
    { method: 'POST' },
  )
