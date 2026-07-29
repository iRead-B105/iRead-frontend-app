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
    await repository.complete('101', '55')

    expect(request).toHaveBeenNthCalledWith(
      1,
      '/api/app/training/101/55/start',
      { method: 'POST' },
    )
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/api/app/training/101/55/complete',
      { method: 'POST' },
    )
  })

  it('문항 응답을 submission 계약으로 전송한다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      submissionId: '11111111-1111-4111-8111-111111111111',
      correct: true,
      questionCompleted: true,
      canRetry: false,
    })
    const repository = new ApiLearnerTrainingRepository()

    await repository.saveSubmission('101', '55', 1, {
      submissionId: '11111111-1111-4111-8111-111111111111',
      responseType: 'TRACE',
      response: {
        canvasWidth: 640,
        canvasHeight: 500,
        strokes: [{ points: [{ x: 10, y: 20, elapsedMs: 0 }, { x: 20, y: 30, elapsedMs: 10 }] }],
      },
    })

    expect(request).toHaveBeenCalledWith(
      '/api/app/training/101/55/questions/1/responses',
      {
        method: 'POST',
        body: JSON.stringify({
          submissionId: '11111111-1111-4111-8111-111111111111',
          responseType: 'TRACE',
          response: {
            canvasWidth: 640,
            canvasHeight: 500,
            strokes: [{ points: [{ x: 10, y: 20, elapsedMs: 0 }, { x: 20, y: 30, elapsedMs: 10 }] }],
          },
        }),
      },
    )
  })

  it('녹음 요청을 backend multipart 필드와 동일하게 구성한다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue({})
    const repository = new ApiLearnerTrainingRepository()
    const audioFile = new File(['audio'], 'answer.webm', { type: 'audio/webm' })

    await repository.saveRecording('101', '55', 2, {
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
    expect(body.has('wordId')).toBe(false)
    expect(body.has('targetIndex')).toBe(false)
    expect(body.get('expectedText')).toBe('토끼')
    expect(body.get('audioFile')).toBe(audioFile)
  })
})
