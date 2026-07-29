import { afterEach, describe, expect, it, vi } from 'vitest'
import { learnerApiClient } from '../learnerApiClient'
import { LearnerContractUnavailableError } from '../integrationError'
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

  it('백엔드 계약이 없는 기능을 mock으로 숨기지 않는다', async () => {
    const repository = new ApiLearnerContentRepository()

    await expect(repository.getCurrentCurriculum('101')).rejects.toBeInstanceOf(
      LearnerContractUnavailableError,
    )
    await expect(repository.getGrowthAreas('101')).rejects.toMatchObject({
      code: 'LEARNER_GROWTH_MAPPING_REQUIRED',
    })
  })
})
