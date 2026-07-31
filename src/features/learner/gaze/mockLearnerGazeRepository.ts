import type { LearnerGazeRepository } from './repository'

export class MockLearnerGazeRepository implements LearnerGazeRepository {
  readonly source = 'mock' as const

  async start(input: Parameters<LearnerGazeRepository['start']>[0]) {
    return {
      gazeSessionId: 'mock-gaze-session',
      collectionStatus: 'RUNNING',
      calibrationStatus: input.calibrationStatus,
      startedAt: new Date().toISOString(),
      endedAt: null,
    }
  }

  async end(
    gazeSessionId: string,
    _studentId: string,
    endStatus: 'COMPLETED' | 'FAILED',
  ) {
    return {
      gazeSessionId,
      collectionStatus: endStatus,
      calibrationStatus: 'SUCCESS' as const,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    }
  }

  async fail(): Promise<void> {}
}
