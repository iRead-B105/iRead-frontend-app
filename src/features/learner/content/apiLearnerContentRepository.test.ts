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
          entryImageUrl: '/uploads/story/31/entry.png',
          latestBranchSubtitle: '달빛 문을 찾아서',
          storyStatus: 'IN_PROGRESS',
          progress: 65,
        },
      ],
      storyTemplates: [{
        storyTemplateId: 4,
        templateTitle: '용감한 토끼',
        imageUrl: '/images/brave-rabbit.png',
      }],
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
      latestBranchSubtitle: '달빛 문을 찾아서',
      status: 'IN_PROGRESS',
      progress: 65,
      coverImageUrl: '/images/brave-rabbit.png',
      entryImageUrl: '/uploads/story/31/entry.png',
    })
    expect(result.templates[0]).toMatchObject({
      templateId: '4',
      title: '용감한 토끼',
      coverImageUrl: '/images/brave-rabbit.png',
    })
  })

  it('Spring line 단위를 아동 reader의 페이지 모델로 변환한다', async () => {
    vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      storyId: 31,
      storyStatus: 'IN_PROGRESS',
      currentDay: 2,
      availableDay: 2,
      totalDays: 10,
      pagesPerDay: 10,
      dayComplete: false,
      storyLines: [
        {
          lineId: 9,
          storyId: 31,
          imageUrl: '/uploads/scene.png',
          requiresBranchInput: true,
          lineText: '토끼가 숲길을 걸었어요.',
          sceneOrder: 2,
          lineOrder: 1,
          readAt: null,
          branchPrompt: {
            subtitle: '숲길의 세 가지 약속',
            options: [
              { optionNo: 1, label: '숲으로 가요' },
              { optionNo: 2, label: '친구를 찾아요' },
              { optionNo: 3, label: '잠시 쉬어요' },
            ],
          },
        },
        {
          lineId: 8,
          storyId: 31,
          imageUrl: null,
          requiresBranchInput: false,
          lineText: '아침이 밝았어요.',
          sceneOrder: 1,
          lineOrder: 2,
          readAt: '2026-07-29T10:01:00',
          branchPrompt: null,
        },
      ],
    })
    const repository = new ApiLearnerContentRepository()

    const result = await repository.getStoryDetail('101', '31')

    expect(result.pages.map((page) => page.lineId)).toEqual(['8', '9'])
    expect(result.pages[1]?.lines).toEqual(['토끼가 숲길을 걸었어요.'])
    expect(result.pages[1]?.requiresBranchInput).toBe(true)
    expect(result.pages[1]?.branchPrompt?.options).toHaveLength(3)
    expect(result.pages[1]?.branchPrompt?.subtitle).toBe('숲길의 세 가지 약속')
    expect(result).toMatchObject({
      status: 'IN_PROGRESS',
      currentDay: 2,
      availableDay: 2,
      totalDays: 10,
      pagesPerDay: 10,
      dayComplete: false,
    })
  })

  it('이야기 상세 응답을 모든 인증 이미지 다운로드로 막지 않는다', async () => {
    const generatedImage = '/uploads/images/123e4567-e89b-12d3-a456-426614174001.png'
    vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      storyId: 31,
      storyStatus: 'IN_PROGRESS',
      currentDay: 1,
      availableDay: 1,
      totalDays: 10,
      pagesPerDay: 10,
      dayComplete: false,
      storyLines: [{
        lineId: 8,
        storyId: 31,
        imageUrl: generatedImage,
        requiresBranchInput: false,
        lineText: '바로 읽을 수 있는 문장이에요.',
        sceneOrder: 1,
        lineOrder: 1,
        readAt: null,
        branchPrompt: null,
      }],
    })
    const download = vi.spyOn(learnerApiClient, 'download')
    const repository = new ApiLearnerContentRepository()

    const result = await repository.getStoryDetail('101', '31')

    expect(result.pages[0]?.imageUrl).toBe(generatedImage)
    expect(download).not.toHaveBeenCalled()
  })

  it('현재 커리큘럼과 성장 정보를 화면 모델로 변환한다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request')
      .mockResolvedValueOnce({
        curriculumId: 71,
        curriculumStatus: 'IN_PROGRESS',
        trainings: [
          {
            trainingId: 102,
            trainingTemplateId: 2500,
            trainingType: 'SENTENCE_READING',
            sequenceNo: 2,
            unitName: '글 해독',
            trainingName: '문장 읽기',
            status: 'NOT_READY',
          },
          {
            trainingId: 101,
            trainingTemplateId: 22,
            trainingType: 'WORD_READING',
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
        growthAreas: [
          {
            areaId: 1,
            name: '파닉스',
            stage: 2,
            completedCount: 3,
            nextStageProgressPercent: 37,
            nextStageHint: '훈련을 5번 더 하면 자라나요!',
            updatedAt: null,
          },
          { areaId: 2, name: '읽기', stage: 3, completedCount: 8, updatedAt: null },
          { areaId: 3, name: '유창성', stage: 1, completedCount: 1, updatedAt: null },
        ],
      })
    const repository = new ApiLearnerContentRepository()

    const curriculum = await repository.getCurrentCurriculum('101')
    const growth = await repository.getGrowthAreas('101')

    expect(request).toHaveBeenNthCalledWith(1, '/api/app/training/101', {
      signal: undefined,
    }, {
      suppressErrorHandler: true,
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
    expect(growth.map((area) => area.learningCount)).toEqual([3, 8, 1])
    expect(growth.map((area) => area.stage)).toEqual([2, 3, 1])
    expect(growth.map((area) => area.nextStageProgressPercent)).toEqual([37, null, null])
    expect(growth.map((area) => area.nextStageHint)).toEqual([
      '훈련을 5번 더 하면 자라나요!',
      null,
      null,
    ])
  })

  it('화면 매핑이 없는 훈련 템플릿을 조용히 누락하지 않는다', async () => {
    vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      curriculumId: 71,
      curriculumStatus: 'NOT_STARTED',
      trainings: [{
        trainingId: 999,
        trainingTemplateId: 22,
        trainingType: 'UNSUPPORTED_NEW_TYPE',
        sequenceNo: 1,
        unitName: '미정',
        trainingName: '신규 훈련',
        status: 'NOT_STARTED',
      }],
    })
    const repository = new ApiLearnerContentRepository()

    await expect(repository.getCurrentCurriculum('101')).rejects.toThrow(
      'trainingType=UNSUPPORTED_NEW_TYPE, trainingTemplateId=22의 화면 매핑이 없습니다.',
    )
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

  it('진행 중 이야기 삭제를 학생과 이야기 식별자로 요청한다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue(undefined)
    const repository = new ApiLearnerContentRepository()

    await repository.deleteStory('101', '31')

    expect(request).toHaveBeenCalledWith(
      '/api/app/story/101/sessions/31',
      { method: 'DELETE' },
    )
  })

  it('NOT_READY만 남으면 진행 훈련 없이 오늘 학습 완료로 취급한다', async () => {
    vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      curriculumId: 72,
      curriculumStatus: 'IN_PROGRESS',
      trainings: [
        {
          trainingId: 201,
          trainingTemplateId: 22,
          trainingType: 'WORD_READING',
          sequenceNo: 1,
          unitName: 'unit',
          trainingName: 'completed',
          status: 'COMPLETED',
        },
        {
          trainingId: 202,
          trainingTemplateId: 2500,
          trainingType: 'SENTENCE_READING',
          sequenceNo: 2,
          unitName: 'unit',
          trainingName: 'next',
          status: 'NOT_READY',
        },
      ],
    })
    const repository = new ApiLearnerContentRepository()

    const curriculum = await repository.getCurrentCurriculum('101')

    // 문항이 생성되지 않은 NOT_READY 훈련은 진행 대상이 아니다.
    // currentOrder가 목록 길이를 넘어가 오늘 학습 완료(진입 차단)로 이어진다.
    expect(curriculum.currentOrder).toBe(3)
    expect(curriculum.trainings.map((training) => training.status)).toEqual([
      'COMPLETED',
      'LOCKED',
    ])
  })
})
