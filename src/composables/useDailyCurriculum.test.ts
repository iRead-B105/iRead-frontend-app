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

  it('주기 갱신 중에는 현재 교육과정을 유지해서 준비 화면으로 깜빡이지 않는다', async () => {
    learnerState.studentId = '2199'
    let resolveRefresh!: (value: ReturnType<typeof curriculum>) => void
    learnerState.fetchCurrentCurriculum
      .mockResolvedValueOnce(curriculum('190099', 'READY', 1))
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveRefresh = resolve
      }))

    const dailyCurriculum = useDailyCurriculum()
    await dailyCurriculum.loadCurrentCurriculum()

    const refresh = dailyCurriculum.reloadCurrentCurriculum()
    await Promise.resolve()

    expect(dailyCurriculum.curriculumStatus.value).toBe('ready')
    expect(dailyCurriculum.curriculumItems).toHaveLength(1)
    expect(dailyCurriculum.curriculumItems[0]?.status).toBe('CURRENT')

    resolveRefresh(curriculum('190099', 'COMPLETED', 2))
    await refresh

    expect(dailyCurriculum.curriculumStatus.value).toBe('completed')
  })
})
