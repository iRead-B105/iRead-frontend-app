import { beforeEach, describe, expect, it, vi } from 'vitest'

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
})
