import { afterEach, describe, expect, it, vi } from 'vitest'
import { learnerApiClient } from '../learnerApiClient'
import { ApiLearnerTestRepository } from './apiLearnerTestRepository'

describe('ApiLearnerTestRepository challenge plan', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })
  it('전체 다음 검사와 영역을 Backend 응답 그대로 연결한다', async () => {
    vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      testCurriculumId: '1739619061890340497',
      completedQuestions: 3,
      totalQuestions: 9,
      completed: false,
      nextTestId: '104',
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
          nextTestId: '104',
        },
      ],
    })

    await expect(
      new ApiLearnerTestRepository().getChallengePlan('20'),
    ).resolves.toMatchObject({
      testCurriculumId: '1739619061890340497',
      nextTestId: '104',
      nextTrackCode: 'short-text',
      completedQuestions: 3,
    })
  })

  it('검사 요청 body에서 ID를 JavaScript number로 변환하지 않는다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      submissionId: 'submission-1',
      accepted: true,
    })
    const repository = new ApiLearnerTestRepository()

    await repository.start('20', '1739619061890340497')
    await repository.saveSubmission('20', '1739619061890340497', 1, {
      submissionId: 'submission-input-1',
      responseType: 'SINGLE_CHOICE',
      response: { selectedAnswer: '가' },
    })
    await repository.complete('20', '1739619061890340497')

    expect(request).toHaveBeenNthCalledWith(1, '/api/app/test/20/start', {
      method: 'POST',
      body: JSON.stringify({ testId: '1739619061890340497' }),
    })
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/api/app/test/20/questions/1/responses',
      {
        method: 'POST',
        body: JSON.stringify({
          testId: '1739619061890340497',
          submission: {
            submissionId: 'submission-input-1',
            responseType: 'SINGLE_CHOICE',
            response: { selectedAnswer: '가' },
          },
        }),
      },
    )
    expect(request).toHaveBeenNthCalledWith(3, '/api/app/test/20/complete', {
      method: 'POST',
      body: JSON.stringify({ testId: '1739619061890340497' }),
    })
  })
})
