// @vitest-environment jsdom

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LearnerAuthRepository } from '@/features/learner/auth'
import type { LearnerStudent } from '@/features/learner/model'
import { useLearnerSessionStore } from './learnerSession'

const student: LearnerStudent = {
  studentId: '101',
  name: '가람',
  age: null,
  profileColor: '#f18ca4',
  profileImageUrl: null,
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key) {
      return values.get(key) ?? null
    },
    key(index) {
      return [...values.keys()][index] ?? null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
  }
}

const testLocalStorage = createMemoryStorage()
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: testLocalStorage,
})

function createRepository(
  overrides: Partial<LearnerAuthRepository> = {},
): LearnerAuthRepository {
  return {
    source: 'api',
    loginTeacher: vi.fn().mockResolvedValue({
      teacherId: '7',
      bootstrapToken: 'bootstrap-token',
      linkedStudents: [student],
      expiresIn: 300,
    }),
    loginStudent: vi.fn().mockResolvedValue({
      studentId: student.studentId,
      accessToken: 'learning-token',
      expiresIn: 900,
    }),
    refresh: vi.fn().mockResolvedValue({
      studentId: '',
      accessToken: 'refreshed-token',
      expiresIn: 900,
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('learner session store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    testLocalStorage.clear()
  })

  it('bootstrap token과 learning token의 생명주기를 분리한다', async () => {
    const repository = createRepository()
    const session = useLearnerSessionStore()

    await session.loginTeacher(
      { email: 'teacher@example.com', password: 'password123' },
      repository,
    )
    expect(session.status).toBe('selecting-student')
    expect(session.bootstrapToken).toBe('bootstrap-token')
    expect(session.accessToken).toBeNull()

    await session.loginStudent(student.studentId, repository)
    expect(repository.loginStudent).toHaveBeenCalledWith(student, 'bootstrap-token')
    expect(session.bootstrapToken).toBeNull()
    expect(session.accessToken).toBe('learning-token')
    expect(session.authenticated).toBe(true)
    expect(window.localStorage).toHaveLength(0)
  })

  it('access token은 저장하지 않고 선택 아동만 sessionStorage에 보존한다', async () => {
    const repository = createRepository()
    const session = useLearnerSessionStore()
    await session.loginTeacher(
      { email: 'teacher@example.com', password: 'password123' },
      repository,
    )
    await session.loginStudent(student.studentId, repository)

    const cachedValues = Object.values(sessionStorage)
    expect(cachedValues.join(' ')).toContain(student.studentId)
    expect(cachedValues.join(' ')).not.toContain('learning-token')
  })

  it('새로고침 시 cookie refresh와 아동 캐시로 학습 세션을 복구한다', async () => {
    const repository = createRepository()
    const firstSession = useLearnerSessionStore()
    await firstSession.loginTeacher(
      { email: 'teacher@example.com', password: 'password123' },
      repository,
    )
    await firstSession.loginStudent(student.studentId, repository)

    setActivePinia(createPinia())
    const restoredSession = useLearnerSessionStore()
    await expect(restoredSession.restoreSession(repository)).resolves.toBe(true)

    expect(repository.refresh).toHaveBeenCalledOnce()
    expect(restoredSession.student).toEqual(student)
    expect(restoredSession.accessToken).toBe('refreshed-token')
  })

  it('동시 401 요청은 refresh를 한 번만 실행한다', async () => {
    let resolveRefresh!: (value: {
      studentId: string
      accessToken: string
      expiresIn: number
    }) => void
    const refreshResult = new Promise<{
      studentId: string
      accessToken: string
      expiresIn: number
    }>((resolve) => {
      resolveRefresh = resolve
    })
    const repository = createRepository({
      refresh: vi.fn().mockReturnValue(refreshResult),
    })
    sessionStorage.setItem('iread-learner-student-v1', JSON.stringify(student))
    const session = useLearnerSessionStore()

    const first = session.handleUnauthorized(false, repository)
    const second = session.handleUnauthorized(false, repository)
    resolveRefresh({ studentId: '', accessToken: 'refreshed-token', expiresIn: 900 })

    await expect(Promise.all([first, second])).resolves.toEqual([true, true])
    expect(repository.refresh).toHaveBeenCalledOnce()
  })

  it('로그아웃은 현재 learning token을 전달하고 모든 아동 상태를 제거한다', async () => {
    const repository = createRepository()
    const session = useLearnerSessionStore()
    await session.loginTeacher(
      { email: 'teacher@example.com', password: 'password123' },
      repository,
    )
    await session.loginStudent(student.studentId, repository)

    await session.logout(repository)

    expect(repository.logout).toHaveBeenCalledWith('learning-token')
    expect(session.status).toBe('anonymous')
    expect(session.student).toBeNull()
    expect(sessionStorage).toHaveLength(0)
  })
})
