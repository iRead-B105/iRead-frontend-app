import { describe, expect, it, vi } from 'vitest'
import { learnerApiClient } from '../learnerApiClient'
import { ApiLearnerTestRepository } from './apiLearnerTestRepository'

describe('ApiLearnerTestRepository challenge plan', () => {
  it('전체 다음 검사와 영역을 Backend 응답 그대로 연결한다', async () => {
    vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      testCurriculumId: 500,
      completedQuestions: 3,
      totalQuestions: 9,
      completed: false,
      nextTestId: 104,
      nextTrackCode: 'short-text',
      tracks: [
        {
          trackCode: 'phonological',
          title: '음운 인식',
          status: 'COMPLETED',
          completedQuestions: 3,
          totalQuestions: 3,
          nextTestId: null,
        },
        {
          trackCode: 'short-text',
          title: '짧은 글',
          status: 'NOT_STARTED',
          completedQuestions: 0,
          totalQuestions: 3,
          nextTestId: 104,
        },
      ],
    })

    await expect(
      new ApiLearnerTestRepository().getChallengePlan('20'),
    ).resolves.toMatchObject({
      testCurriculumId: '500',
      nextTestId: '104',
      nextTrackCode: 'short-text',
      completedQuestions: 3,
    })
  })
})
