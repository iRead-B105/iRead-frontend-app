import { afterEach, describe, expect, it, vi } from 'vitest'
import { learnerApiClient } from '../learnerApiClient'
import { ApiLearnerTrainingRepository } from './apiLearnerTrainingRepository'

describe('API learner training repository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('훈련 시작과 완료를 학습 앱 endpoint로 보낸다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue({})
    const repository = new ApiLearnerTrainingRepository()

    await repository.start('101', '55')
    await repository.complete(
      '101',
      '55',
      { completedQuestionIds: ['q1'] },
      '2026-07-29T10:00:00',
    )

    expect(request).toHaveBeenNthCalledWith(
      1,
      '/api/app/training/101/55/start',
      { method: 'POST' },
    )
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/api/app/training/101/55/complete',
      {
        method: 'POST',
        body: JSON.stringify({
          result: { completedQuestionIds: ['q1'] },
          completedAt: '2026-07-29T10:00:00',
        }),
      },
    )
  })

  it('녹음 요청을 backend multipart 필드와 동일하게 구성한다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue({})
    const repository = new ApiLearnerTrainingRepository()
    const audioFile = new File(['audio'], 'answer.webm', { type: 'audio/webm' })

    await repository.saveRecording('101', '55', 2, {
      wordId: 7,
      targetIndex: 1,
      expectedText: '토끼',
      audioFile,
      speechStartOffsetMs: 120,
    })

    const init = request.mock.calls[0]?.[1] as RequestInit
    expect(request.mock.calls[0]?.[0]).toBe(
      '/api/app/training/101/55/questions/2/recordings',
    )
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    const body = init.body as FormData
    expect(body.get('wordId')).toBe('7')
    expect(body.get('expectedText')).toBe('토끼')
    expect(body.get('audioFile')).toBe(audioFile)
  })
})
