import { afterEach, describe, expect, it, vi } from 'vitest'
import { learnerApiClient } from '../learnerApiClient'
import { ApiLearnerGazeRepository } from './apiLearnerGazeRepository'

describe('API learner gaze repository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts a gaze session with numeric ids for the backend', async () => {
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

  it('ends a gaze session with collected data', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      gazeSessionId: 81,
      collectionStatus: 'COMPLETED',
      calibrationStatus: 'SUCCESS',
      startedAt: '2026-07-29T10:00:00',
      endedAt: '2026-07-29T10:05:00',
    })
    const repository = new ApiLearnerGazeRepository()
    const data = {
      schemaVersion: 1,
      samples: [{ x: 120, y: 240, capturedAtMs: 1, questionNumber: 1 }],
      words: [{
        questionNo: 1,
        targetIndex: 0,
        tokenIndex: 0,
        text: 'ga',
        dwellMs: 120,
        visitCount: 1,
        regressionCount: 0,
        firstSeenMs: 0,
        lastSeenMs: 120,
      }],
    }

    const result = await repository.end('81', '101', 'COMPLETED', data)

    expect(request).toHaveBeenCalledWith('/api/app/gaze/sessions/81/end', {
      method: 'PATCH',
      body: JSON.stringify({
        studentId: 101,
        endStatus: 'COMPLETED',
        data,
      }),
    })
    expect(result.collectionStatus).toBe('COMPLETED')
  })
})
