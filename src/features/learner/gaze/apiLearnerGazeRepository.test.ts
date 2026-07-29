import { afterEach, describe, expect, it, vi } from 'vitest'
import { learnerApiClient } from '../learnerApiClient'
import { ApiLearnerGazeRepository } from './apiLearnerGazeRepository'

describe('API learner gaze repository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('문자열 UI 식별자를 Spring 숫자 식별자로 변환해 session을 시작한다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      gazeSessionId: 81,
      collectionStatus: 'RUNNING',
      calibrationStatus: 'SUCCESS',
      startedAt: '2026-07-29T10:00:00',
      endedAt: null,
    })
    const repository = new ApiLearnerGazeRepository()

    const result = await repository.start({
      studentId: '101',
      contentType: 'TRAINING',
      trainingId: '55',
      calibrationStatus: 'SUCCESS',
    })

    expect(request).toHaveBeenCalledWith('/api/app/gaze/sessions', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 101,
        contentType: 'TRAINING',
        trainingId: 55,
        calibrationStatus: 'SUCCESS',
      }),
    })
    expect(result.gazeSessionId).toBe('81')
  })

  it('분석 결과의 studentId만 숫자로 바꾸고 측정값은 보존한다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      gazeAnalysisId: 91,
    })
    const repository = new ApiLearnerGazeRepository()

    const result = await repository.saveAnalysis('81', {
      studentId: '101',
      totalVisitedDuration: 65000,
      totalVisitedCount: 23,
      reverseReadCount: 4,
    })

    expect(request).toHaveBeenCalledWith(
      '/api/app/gaze/sessions/81/analysis-results',
      {
        method: 'POST',
        body: JSON.stringify({
          studentId: 101,
          totalVisitedDuration: 65000,
          totalVisitedCount: 23,
          reverseReadCount: 4,
        }),
      },
    )
    expect(result).toBe('91')
  })
})
