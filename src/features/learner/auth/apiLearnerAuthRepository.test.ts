import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from '@/lib/api'
import { ApiLearnerAuthRepository } from './apiLearnerAuthRepository'

describe('API learner auth repository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('교수자 bootstrap 로그인 응답을 아동 선택 모델로 변환한다', async () => {
    const request = vi.spyOn(ApiClient.prototype, 'request').mockResolvedValue({
      teacherId: '7',
      teacherSessionToken: 'bootstrap-token',
      linkedStudents: [
        { studentId: '101', name: '가람', profileImage: '/uploads/profile.png' },
      ],
      expiresIn: 300,
    })
    const repository = new ApiLearnerAuthRepository()

    const result = await repository.loginTeacher({
      email: 'teacher@example.com',
      password: 'password123',
    })

    expect(request).toHaveBeenCalledWith(
      '/api/auth/app/teacher-login',
      {
        method: 'POST',
        body: JSON.stringify({
          email: 'teacher@example.com',
          password: 'password123',
        }),
      },
      { retryOnUnauthorized: false },
    )
    expect(result.bootstrapToken).toBe('bootstrap-token')
    expect(result.linkedStudents[0]).toMatchObject({
      studentId: '101',
      name: '가람',
      age: null,
      profileImageUrl: '/uploads/profile.png',
    })
  })

  it('student-login에 bootstrap token만 명시적으로 전달한다', async () => {
    const request = vi.spyOn(ApiClient.prototype, 'request').mockResolvedValue({
      studentId: '101',
      accessToken: 'learning-token',
      expiresIn: 900,
    })
    const repository = new ApiLearnerAuthRepository()

    await repository.loginStudent(
      {
        studentId: '101',
        name: '가람',
        age: null,
        profileColor: '#f18ca4',
        profileImageUrl: null,
      },
      'bootstrap-token',
    )

    expect(request).toHaveBeenCalledWith(
      '/api/auth/app/student-login',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer bootstrap-token' },
        body: JSON.stringify({ studentId: '101' }),
      },
      { retryOnUnauthorized: false },
    )
  })
})
