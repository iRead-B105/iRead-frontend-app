import { defineStore } from 'pinia'
import { learnerAuthRepository, type LearnerAuthRepository } from '@/features/learner/auth'
import { clearAuthenticatedProfileImages } from '@/features/learner/auth/authenticatedProfileImage'
import { clearAuthenticatedStoryImages } from '@/features/learner/story/authenticatedStoryImage'
import {
  learnerStudentRepository,
  type LearnerLearningEntry,
  type LearnerStudentRepository,
} from '@/features/learner/student'
import type {
  LearnerStudent,
  LearnerTeacherLoginInput,
} from '@/features/learner/model'
import { ApiError } from '@/lib/api'

const STUDENT_SESSION_KEY = 'iread-learner-student-v1'

export type LearnerAuthenticationStatus =
  | 'unknown'
  | 'restoring'
  | 'selecting-student'
  | 'authenticated'
  | 'anonymous'

function readCachedStudent(): LearnerStudent | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(STUDENT_SESSION_KEY) ?? 'null') as unknown
    if (
      value &&
      typeof value === 'object' &&
      'studentId' in value &&
      typeof value.studentId === 'string' &&
      'name' in value &&
      typeof value.name === 'string'
    ) {
      return value as LearnerStudent
    }
  } catch {
    // 손상된 브라우저 캐시는 인증 복구에 사용하지 않는다.
  }
  return null
}

function cacheStudent(student: LearnerStudent | null): void {
  if (student) {
    sessionStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(student))
  } else {
    sessionStorage.removeItem(STUDENT_SESSION_KEY)
  }
}

function isExpiredLogout(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    ['INVALID_REFRESH_TOKEN', 'UNAUTHORIZED'].includes(error.code)
  )
}

async function clearLearnerImageCaches(): Promise<void> {
  await Promise.all([
    clearAuthenticatedProfileImages(),
    clearAuthenticatedStoryImages(),
  ])
}

export const useLearnerSessionStore = defineStore('learner-session', {
  state: () => ({
    status: 'unknown' as LearnerAuthenticationStatus,
    bootstrapToken: null as string | null,
    accessToken: null as string | null,
    teacherId: null as string | null,
    linkedStudents: [] as LearnerStudent[],
    student: null as LearnerStudent | null,
    loginPending: false,
    logoutPending: false,
    restorePromise: null as Promise<boolean> | null,
    refreshPromise: null as Promise<boolean> | null,
    authenticationError: null as string | null,
    learningEntry: null as LearnerLearningEntry | null,
    learningEntryError: null as string | null,
    learningEntryPromise: null as Promise<LearnerLearningEntry> | null,
  }),
  getters: {
    authenticated: (state) =>
      state.status === 'authenticated' && state.accessToken !== null && state.student !== null,
  },
  actions: {
    replaceStudentProfile(student: LearnerStudent) {
      if (this.student?.studentId !== student.studentId) return
      this.student = { ...student }
      cacheStudent(this.student)
    },
    reset(options: { preserveStudentCache?: boolean; preserveImageCache?: boolean } = {}) {
      this.status = 'anonymous'
      this.bootstrapToken = null
      this.accessToken = null
      this.teacherId = null
      this.linkedStudents = []
      this.student = null
      this.authenticationError = null
      this.learningEntry = null
      this.learningEntryError = null
      this.learningEntryPromise = null
      if (!options.preserveStudentCache) cacheStudent(null)
      if (!options.preserveImageCache) void clearLearnerImageCaches()
    },
    async loginTeacher(
      input: LearnerTeacherLoginInput,
      repository: LearnerAuthRepository = learnerAuthRepository,
    ) {
      if (this.loginPending) return false
      this.loginPending = true
      this.authenticationError = null
      try {
        const bootstrap = await repository.loginTeacher(input)
        this.teacherId = bootstrap.teacherId
        this.bootstrapToken = bootstrap.bootstrapToken
        this.linkedStudents = bootstrap.linkedStudents.map((student) => ({ ...student }))
        this.status = 'selecting-student'
        return true
      } catch (error) {
        this.reset()
        this.authenticationError =
          error instanceof Error ? error.message : '교수자 로그인에 실패했습니다.'
        throw error
      } finally {
        this.loginPending = false
      }
    },
    async loginStudent(
      studentId: string,
      repository: LearnerAuthRepository = learnerAuthRepository,
    ) {
      if (this.loginPending || !this.bootstrapToken) return false
      const student = this.linkedStudents.find((item) => item.studentId === studentId)
      if (!student) return false

      this.loginPending = true
      this.authenticationError = null
      try {
        const session = await repository.loginStudent(student, this.bootstrapToken)
        this.accessToken = session.accessToken
        this.student = { ...student, studentId: session.studentId || student.studentId }
        cacheStudent(this.student)
        this.bootstrapToken = null
        this.status = 'authenticated'
        this.learningEntry = null
        this.learningEntryError = null
        return true
      } catch (error) {
        this.authenticationError =
          error instanceof Error ? error.message : '아동 학습 세션을 시작할 수 없습니다.'
        throw error
      } finally {
        this.loginPending = false
      }
    },
    async resolveLearningEntry(
      force = false,
      repository: LearnerStudentRepository = learnerStudentRepository,
    ) {
      if (!this.authenticated || !this.student) {
        throw new Error('아동 학습 세션을 먼저 시작해 주세요.')
      }
      if (!force && this.learningEntry) return this.learningEntry
      if (this.learningEntryPromise) return this.learningEntryPromise

      this.learningEntryError = null
      const studentId = this.student.studentId
      const task = repository.getLearningEntry(studentId)
        .then((entry) => {
          if (this.student?.studentId === studentId) this.learningEntry = entry
          return entry
        })
        .catch((error: unknown) => {
          this.learningEntryError =
            error instanceof Error ? error.message : '학습 시작 상태를 확인하지 못했습니다.'
          throw error
        })
        .finally(() => {
          if (this.learningEntryPromise === task) this.learningEntryPromise = null
        })

      this.learningEntryPromise = task
      return task
    },
    markChallengeCompleted() {
      if (!this.student) return
      this.learningEntry = {
        studentId: this.student.studentId,
        entryStatus: 'HOME',
        testCurriculumId: null,
        completedQuestions: 9,
        totalQuestions: 9,
      }
      this.learningEntryError = null
    },
    async refreshAccessToken(repository: LearnerAuthRepository = learnerAuthRepository) {
      if (this.refreshPromise) return this.refreshPromise
      const cachedStudent = this.student ?? readCachedStudent()
      if (!cachedStudent) {
        this.reset()
        return false
      }

      const refreshTask = (async () => {
        try {
          const session = await repository.refresh()
          this.accessToken = session.accessToken
          this.student = {
            ...cachedStudent,
            studentId: session.studentId || cachedStudent.studentId,
          }
          cacheStudent(this.student)
          this.status = 'authenticated'
          return true
        } catch {
          this.reset()
          return false
        }
      })()

      this.refreshPromise = refreshTask
      try {
        return await refreshTask
      } finally {
        if (this.refreshPromise === refreshTask) this.refreshPromise = null
      }
    },
    async restoreSession(repository: LearnerAuthRepository = learnerAuthRepository) {
      if (this.authenticated) return true
      if (this.status === 'anonymous') return false
      if (this.restorePromise) return this.restorePromise

      this.status = 'restoring'
      const restoreTask = this.refreshAccessToken(repository)
      this.restorePromise = restoreTask
      try {
        return await restoreTask
      } finally {
        if (this.restorePromise === restoreTask) this.restorePromise = null
      }
    },
    async handleUnauthorized(
      requestRetried: boolean,
      repository: LearnerAuthRepository = learnerAuthRepository,
    ) {
      if (requestRetried) {
        this.reset()
        return false
      }
      return this.refreshAccessToken(repository)
    },
    async logout(repository: LearnerAuthRepository = learnerAuthRepository) {
      if (this.logoutPending) return false
      this.logoutPending = true
      try {
        await repository.logout(this.accessToken)
        this.reset({ preserveImageCache: true })
        await clearLearnerImageCaches()
        return true
      } catch (error) {
        if (isExpiredLogout(error)) {
          this.reset({ preserveImageCache: true })
          await clearLearnerImageCaches()
          return true
        }
        this.authenticationError =
          error instanceof Error ? error.message : '로그아웃에 실패했습니다.'
        throw error
      } finally {
        this.logoutPending = false
      }
    },
    cancelStudentSelection() {
      this.reset()
    },
  },
})
