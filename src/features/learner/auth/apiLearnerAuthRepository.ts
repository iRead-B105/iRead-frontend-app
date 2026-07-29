import { createApiClient, jsonBody, type ApiErrorHandler } from '@/lib/api'
import type {
  LearnerLoginSession,
  LearnerStudent,
  LearnerTeacherBootstrap,
  LearnerTeacherLoginInput,
} from '../model'
import type { LearnerAuthRepository } from './repository'

interface AppTeacherLoginDto {
  readonly teacherId: string
  readonly teacherSessionToken: string
  readonly linkedStudents: readonly {
    readonly studentId: string
    readonly name: string
    readonly profileImage: string | null
  }[]
  readonly expiresIn: number
}

interface StudentLoginDto {
  readonly studentId: string
  readonly accessToken: string
  readonly expiresIn: number
}

interface TokenRefreshDto {
  readonly accessToken: string
  readonly expiresIn: number
}

const unauthenticatedClient = createApiClient()

export function configureLearnerAuthApiErrors(onError: ApiErrorHandler): void {
  unauthenticatedClient.configureAuth({ onError })
}

function profileColor(studentId: string): string {
  const colors = ['#f18ca4', '#71a9ef', '#9acb62', '#f2ad5f', '#a98de3']
  const numericId = Number.parseInt(studentId, 10)
  return colors[Number.isFinite(numericId) ? numericId % colors.length : 0]!
}

export class ApiLearnerAuthRepository implements LearnerAuthRepository {
  readonly source = 'api' as const

  async loginTeacher(input: LearnerTeacherLoginInput): Promise<LearnerTeacherBootstrap> {
    const response = await unauthenticatedClient.request<AppTeacherLoginDto>(
      '/api/auth/app/teacher-login',
      {
        method: 'POST',
        body: jsonBody(input),
      },
      { retryOnUnauthorized: false },
    )

    return {
      teacherId: response.teacherId,
      bootstrapToken: response.teacherSessionToken,
      expiresIn: response.expiresIn,
      linkedStudents: response.linkedStudents.map((student) => ({
        studentId: student.studentId,
        name: student.name,
        age: null,
        profileColor: profileColor(student.studentId),
        profileImageUrl: student.profileImage,
      })),
    }
  }

  async loginStudent(
    student: LearnerStudent,
    bootstrapToken: string,
  ): Promise<LearnerLoginSession> {
    const response = await unauthenticatedClient.request<StudentLoginDto>(
      '/api/auth/app/student-login',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${bootstrapToken}` },
        body: jsonBody({ studentId: student.studentId }),
      },
      { retryOnUnauthorized: false },
    )

    return {
      studentId: response.studentId,
      accessToken: response.accessToken,
      expiresIn: response.expiresIn,
    }
  }

  async refresh(): Promise<LearnerLoginSession> {
    const response = await unauthenticatedClient.request<TokenRefreshDto>(
      '/api/auth/app/refresh',
      { method: 'POST' },
      { retryOnUnauthorized: false },
    )
    return {
      studentId: '',
      accessToken: response.accessToken,
      expiresIn: response.expiresIn,
    }
  }

  async logout(accessToken: string | null): Promise<void> {
    await unauthenticatedClient.request<void>(
      '/api/auth/app/logout',
      {
        method: 'POST',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      },
      { retryOnUnauthorized: false },
    )
  }
}
