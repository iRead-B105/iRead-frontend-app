import { learnerApiClient } from '@/features/learner/learnerApiClient'

export interface DeveloperCheatResult {
  readonly action: 'RESET_PROGRESS' | 'ADVANCE_TO_NEXT_DAY'
  readonly curriculumId: number
  readonly curriculumStatus: string
  readonly trainingCount: number
}

export const resetDemoLearningProgress = (studentId: string): Promise<DeveloperCheatResult> =>
  learnerApiClient.request(`/api/app/dev/${studentId}/learning/reset`, { method: 'POST' })

export const advanceDemoLearningDay = (studentId: string): Promise<DeveloperCheatResult> =>
  learnerApiClient.request(`/api/app/dev/${studentId}/learning/next-day`, { method: 'POST' })
