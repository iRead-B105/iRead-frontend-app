import { beforeEach, describe, expect, it, vi } from 'vitest'
import { learnerApiClient } from '@/features/learner/learnerApiClient'
import {
  advanceToNextDemoTraining,
  advanceDemoLearningDay,
  resetDemoLearningProgress,
} from './developerCheatService'

describe('developerCheatService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('학습 진행 초기화를 인증이 설정된 학습 API 클라이언트로 요청한다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue({})

    await resetDemoLearningProgress('2001')

    expect(request).toHaveBeenCalledWith(
      '/api/app/dev/2001/learning/reset',
      { method: 'POST' },
    )
  })

  it('다음날 진행도 같은 학습 API 클라이언트로 요청한다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue({})

    await advanceDemoLearningDay('2001')

    expect(request).toHaveBeenCalledWith(
      '/api/app/dev/2001/learning/next-day',
      { method: 'POST' },
    )
  })

  it('현재 훈련 강제 완료와 다음 훈련 해제를 요청한다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue({})

    await advanceToNextDemoTraining('2103', '181031')

    expect(request).toHaveBeenCalledWith(
      '/api/app/dev/2103/learning/trainings/181031/next',
      { method: 'POST' },
    )
  })
})
