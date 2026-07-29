import { afterEach, describe, expect, it, vi } from 'vitest'
import { learnerApiClient } from '../learnerApiClient'
import { ApiLearnerContentRepository } from './apiLearnerContentRepository'

describe('API learner content repository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Spring story shelf DTO를 화면 모델로 변환한다', async () => {
    vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      stories: [
        {
          storyId: 31,
          storyTemplateId: 4,
          createdAt: '2026-07-29T10:00:00',
          storyStatus: 'IN_PROGRESS',
        },
      ],
      storyTemplates: [{ storyTemplateId: 4, templateTitle: '용감한 토끼' }],
    })
    const repository = new ApiLearnerContentRepository()

    const result = await repository.getStoryLibrary('101')

    expect(learnerApiClient.request).toHaveBeenCalledWith('/api/app/story/101', {
      signal: undefined,
    })
    expect(result.stories[0]).toMatchObject({
      storyId: '31',
      templateId: '4',
      title: '용감한 토끼',
      status: 'IN_PROGRESS',
    })
    expect(result.templates[0]).toMatchObject({
      templateId: '4',
      title: '용감한 토끼',
    })
  })

  it('Spring line 단위를 아동 reader의 페이지 모델로 변환한다', async () => {
    vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      storyLines: [
        {
          lineId: 9,
          storyId: 31,
          imageUrl: '/uploads/scene.png',
          requiresBranchInput: true,
          lineText: '토끼가 숲길을 걸었어요.',
          lineOrder: 2,
          readAt: null,
        },
        {
          lineId: 8,
          storyId: 31,
          imageUrl: null,
          requiresBranchInput: false,
          lineText: '아침이 밝았어요.',
          lineOrder: 1,
          readAt: '2026-07-29T10:01:00',
        },
      ],
    })
    const repository = new ApiLearnerContentRepository()

    const result = await repository.getStoryDetail('101', '31')

    expect(result.pages.map((page) => page.lineId)).toEqual(['8', '9'])
    expect(result.pages[1]?.lines).toEqual(['토끼가 숲길을 걸었어요.'])
    expect(result.pages[1]?.requiresBranchInput).toBe(true)
  })

  it('현재 커리큘럼과 성장 정보를 화면 모델로 변환한다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request')
      .mockResolvedValueOnce({
        curriculumId: 71,
        curriculumStatus: 'IN_PROGRESS',
        trainings: [
          {
            trainingId: 102,
            trainingTemplateId: 25,
            sequenceNo: 2,
            unitName: '글 해독',
            trainingName: '문장 읽기',
            status: 'NOT_READY',
          },
          {
            trainingId: 101,
            trainingTemplateId: 22,
            sequenceNo: 1,
            unitName: '글 해독',
            trainingName: '낱말 읽기',
            status: 'IN_PROGRESS',
          },
        ],
      })
      .mockResolvedValueOnce({
        trainingProgress: [
          { trainingTemplateId: 1, trainingTemplateName: '모음 따라 보기', completedCount: 2 },
          { trainingTemplateId: 22, trainingTemplateName: '낱말 읽기', completedCount: 3 },
          { trainingTemplateId: 30, trainingTemplateName: '문장 따라 읽기', completedCount: 1 },
        ],
      })
    const repository = new ApiLearnerContentRepository()

    const curriculum = await repository.getCurrentCurriculum('101')
    const growth = await repository.getGrowthAreas('101')

    expect(request).toHaveBeenNthCalledWith(1, '/api/app/training/101', {
      signal: undefined,
    })
    expect(curriculum).toMatchObject({
      curriculumId: '71',
      status: 'READY',
      currentOrder: 1,
    })
    expect(curriculum.trainings).toEqual([
      expect.objectContaining({
        trainingId: '101',
        categoryId: 'fluency',
        lessonId: 'read-real-words',
        status: 'CURRENT',
      }),
      expect.objectContaining({
        trainingId: '102',
        categoryId: 'fluency',
        lessonId: 'read-sentences',
        status: 'LOCKED',
      }),
    ])
    expect(growth.map((area) => area.learningCount)).toEqual([2, 3, 1])
  })

  it('시선 보정 안내를 학생 식별자와 함께 조회한다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      calibrationRequired: true,
      calibrationGuide: '화면의 점을 바라봐 주세요.',
    })
    const repository = new ApiLearnerContentRepository()

    const result = await repository.getGazeCalibrationGuide('101')

    expect(request).toHaveBeenCalledWith(
      '/api/app/gaze/calibration-guide?studentId=101',
      { signal: undefined },
    )
    expect(result.calibrationRequired).toBe(true)
  })
})
