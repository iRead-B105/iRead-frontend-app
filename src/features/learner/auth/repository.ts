import type {
  LearnerLoginSession,
  LearnerStudent,
  LearnerTeacherBootstrap,
  LearnerTeacherLoginInput,
} from '../model'

export interface LearnerAuthRepository {
  readonly source: 'mock' | 'api'
  readonly loginTeacher: (input: LearnerTeacherLoginInput) => Promise<LearnerTeacherBootstrap>
  readonly loginStudent: (
    student: LearnerStudent,
    bootstrapToken: string,
  ) => Promise<LearnerLoginSession>
  readonly refresh: () => Promise<LearnerLoginSession>
  readonly logout: (accessToken: string | null) => Promise<void>
}
