import { learnerRuntimeMock } from '@/mocks/learnerRuntimeMock'
import type {
  LearnerLoginSession,
  LearnerStudent,
  LearnerTeacherBootstrap,
  LearnerTeacherLoginInput,
} from '../model'
import type { LearnerAuthRepository } from './repository'

function toStudent(student: (typeof learnerRuntimeMock.auth.linkedStudents)[number]): LearnerStudent {
  return { ...student }
}

export class MockLearnerAuthRepository implements LearnerAuthRepository {
  readonly source = 'mock' as const

  async loginTeacher(_input: LearnerTeacherLoginInput): Promise<LearnerTeacherBootstrap> {
    return {
      teacherId: 'mock-teacher',
      bootstrapToken: learnerRuntimeMock.auth.teacherSessionToken,
      linkedStudents: learnerRuntimeMock.auth.linkedStudents.map(toStudent),
      expiresIn: 10_800,
    }
  }

  async loginStudent(student: LearnerStudent): Promise<LearnerLoginSession> {
    return {
      studentId: student.studentId,
      accessToken: learnerRuntimeMock.auth.learningAccessToken,
      expiresIn: 10_800,
    }
  }

  async refresh(): Promise<LearnerLoginSession> {
    return {
      studentId: '',
      accessToken: learnerRuntimeMock.auth.learningAccessToken,
      expiresIn: 10_800,
    }
  }

  async logout(): Promise<void> {}
}
