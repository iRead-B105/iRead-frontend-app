import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api'

const learnerState = vi.hoisted(() => ({
  studentId: '2001',
  fetchCurrentCurriculum: vi.fn(),
}))

vi.mock('@/services/learnerDataRepository', () => ({
  fetchCurrentCurriculum: learnerState.fetchCurrentCurriculum,
  getCachedStudent: () => ({
    studentId: learnerState.studentId,
    name: `학습자 ${learnerState.studentId}`,
  }),
}))

import { useDailyCurriculum } from './useDailyCurriculum'

const curriculum = (
  curriculumId: string,
  status: 'READY' | 'COMPLETED',
  currentOrder: number,
) => ({
  curriculumId,
  studyDate: null,
  status,
  currentOrder,
  trainings: [{
    trainingId: `${curriculumId}-1`,
    trainingTemplateId: '4',
    order: 1,
    categoryId: 'phonics' as const,
    lessonId: 'letter-sound-choice',
    unitName: '글자와 소리',
    name: '글자 소리 고르기',
    status: status === 'COMPLETED' ? 'COMPLETED' as const : 'CURRENT' as const,
  }],
})

describe('useDailyCurriculum', () => {
  beforeEach(() => {
    learnerState.fetchCurrentCurriculum.mockReset()
    learnerState.studentId = '2001'
    useDailyCurriculum().clearDailyCurriculum()
  })

  it('composable 생성만으로 인증 전 현재 커리큘럼을 조회하지 않는다', async () => {
    learnerState.fetchCurrentCurriculum.mockResolvedValue(curriculum('180001', 'READY', 1))

    useDailyCurriculum()
    await Promise.resolve()

    expect(learnerState.fetchCurrentCurriculum).not.toHaveBeenCalled()
  })

  it('최종 검수 전 현재 커리큘럼 없음은 오류가 아닌 대기 상태로 처리한다', async () => {
    learnerState.fetchCurrentCurriculum.mockRejectedValue(new ApiError({
      status: 404,
      code: 'ACTIVE_CURRICULUM_NOT_FOUND',
      message: '현재 진행 가능한 커리큘럼을 찾을 수 없습니다.',
    }))
    const dailyCurriculum = useDailyCurriculum()

    await dailyCurriculum.loadCurrentCurriculum()

    expect(dailyCurriculum.curriculumStatus.value).toBe('unavailable')
    expect(dailyCurriculum.curriculumError.value).toBeNull()
    expect(dailyCurriculum.curriculumItems).toHaveLength(0)
  })

  it('학습자가 바뀌면 이전 학습자의 완료 상태를 버리고 새 커리큘럼을 조회한다', async () => {
    learnerState.fetchCurrentCurriculum
      .mockResolvedValueOnce(curriculum('180001', 'COMPLETED', 2))
      .mockResolvedValueOnce(curriculum('180002', 'READY', 1))

    const firstStudent = useDailyCurriculum()
    await firstStudent.loadCurrentCurriculum()
    expect(firstStudent.isTodayComplete.value).toBe(true)
    expect(firstStudent.curriculumId.value).toBe('180001')

    learnerState.studentId = '2002'
    const secondStudent = useDailyCurriculum()

    expect(secondStudent.curriculumStatus.value).toBe('preparing')
    expect(secondStudent.curriculumItems).toHaveLength(0)

    await secondStudent.loadCurrentCurriculum()

    expect(learnerState.fetchCurrentCurriculum).toHaveBeenNthCalledWith(1, '2001')
    expect(learnerState.fetchCurrentCurriculum).toHaveBeenNthCalledWith(2, '2002')
    expect(secondStudent.isTodayComplete.value).toBe(false)
    expect(secondStudent.curriculumId.value).toBe('180002')
    expect(secondStudent.currentIndex.value).toBe(0)
    expect(secondStudent.curriculumItems).toHaveLength(1)
  })

  it('같은 학습자로 다시 들어오면 모든 훈련 상태를 서버 값으로 갱신한다', async () => {
    learnerState.studentId = '2099'
    learnerState.fetchCurrentCurriculum
      .mockResolvedValueOnce({
        ...curriculum('190001', 'READY', 1),
        trainings: [
          {
            ...curriculum('190001', 'READY', 1).trainings[0],
            status: 'CURRENT' as const,
          },
          {
            ...curriculum('190001', 'READY', 1).trainings[0],
            trainingId: '190001-2',
            order: 2,
            status: 'LOCKED' as const,
          },
        ],
      })
      .mockResolvedValueOnce({
        ...curriculum('190001', 'READY', 2),
        trainings: [
          {
            ...curriculum('190001', 'READY', 1).trainings[0],
            status: 'COMPLETED' as const,
          },
          {
            ...curriculum('190001', 'READY', 1).trainings[0],
            trainingId: '190001-2',
            order: 2,
            status: 'CURRENT' as const,
          },
        ],
      })

    const dailyCurriculum = useDailyCurriculum()
    await dailyCurriculum.loadCurrentCurriculum()
    expect(dailyCurriculum.curriculumItems.map((item) => item.status))
      .toEqual(['CURRENT', 'LOCKED'])

    await dailyCurriculum.reloadCurrentCurriculum()

    expect(learnerState.fetchCurrentCurriculum).toHaveBeenCalledTimes(2)
    expect(dailyCurriculum.currentIndex.value).toBe(1)
    expect(dailyCurriculum.curriculumItems.map((item) => item.status))
      .toEqual(['COMPLETED', 'CURRENT'])
  })
})
