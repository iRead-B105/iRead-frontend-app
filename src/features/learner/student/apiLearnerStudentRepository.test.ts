import { describe, expect, it, vi } from 'vitest'
import { learnerApiClient } from '../learnerApiClient'
import { fetchLearnerStudentProfile } from './apiLearnerStudentRepository'

describe('fetchLearnerStudentProfile', () => {
  it('교수자가 수정한 프로필을 아동 세션 모델로 변환한다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      studentId: '2001',
      name: '샛별',
      age: 8,
      profileImageUrl: '/profiles/2001.png',
    })

    await expect(fetchLearnerStudentProfile('2001')).resolves.toEqual({
      studentId: '2001',
      name: '샛별',
      age: 8,
      profileImageUrl: '/profiles/2001.png',
      profileColor: '#71a9ef',
    })
    expect(request).toHaveBeenCalledWith('/api/app/student/2001/profile')
  })
})
