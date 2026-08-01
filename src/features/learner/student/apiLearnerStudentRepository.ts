import { learnerApiClient } from '../learnerApiClient'
import type { LearnerStudent } from '../model'
import type { LearnerLearningEntry, LearnerStudentRepository } from './repository'

interface AppStudentProfileDto {
  readonly studentId: string
  readonly name: string
  readonly age: number | null
  readonly profileImageUrl: string | null
}

interface LearningEntryDto extends Omit<
  LearnerLearningEntry,
  'studentId' | 'testCurriculumId'
> {
  readonly studentId: number
  readonly testCurriculumId: number | null
}

function profileColor(studentId: string): string {
  const colors = ['#f18ca4', '#71a9ef', '#9acb62', '#f2ad5f', '#a98de3']
  const numericId = Number.parseInt(studentId, 10)
  return colors[Number.isFinite(numericId) ? numericId % colors.length : 0]!
}

export async function fetchLearnerStudentProfile(
  studentId: string,
): Promise<LearnerStudent> {
  const profile = await learnerApiClient.request<AppStudentProfileDto>(
    `/api/app/student/${encodeURIComponent(studentId)}/profile`,
  )
  return {
    ...profile,
    profileColor: profileColor(profile.studentId),
  }
}

export class ApiLearnerStudentRepository implements LearnerStudentRepository {
  readonly source = 'api' as const

  async getLearningEntry(studentId: string): Promise<LearnerLearningEntry> {
    const response = await learnerApiClient.request<LearningEntryDto>(
      `/api/app/student/${encodeURIComponent(studentId)}/learning-entry`,
    )
    return {
      ...response,
      studentId: String(response.studentId),
      testCurriculumId:
        response.testCurriculumId === null ? null : String(response.testCurriculumId),
    }
  }
}
