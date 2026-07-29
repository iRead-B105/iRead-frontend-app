export type LearnerGazeContentType = 'TEST' | 'TRAINING' | 'STORY'
export type LearnerGazeCalibrationStatus = 'NOT_STARTED' | 'SUCCESS' | 'FAILED' | 'SKIPPED'
export type LearnerGazeEndStatus = 'COMPLETED' | 'FAILED'

export interface LearnerGazeStartInput {
  readonly studentId: string
  readonly contentType: LearnerGazeContentType
  readonly testId?: string
  readonly trainingId?: string
  readonly storyId?: string
  readonly calibrationStatus: LearnerGazeCalibrationStatus
}

export interface LearnerGazeSession {
  readonly gazeSessionId: string
  readonly collectionStatus: string
  readonly calibrationStatus: LearnerGazeCalibrationStatus
  readonly startedAt: string
  readonly endedAt: string | null
}

export interface LearnerGazeAnalysisInput {
  readonly studentId: string
  readonly totalVisitedDuration: number
  readonly totalVisitedCount: number
  readonly reverseReadCount: number
  readonly avgVisitedDuration?: number
  readonly sentenceMetrics?: unknown
}

export interface LearnerGazeRepository {
  readonly source: 'mock' | 'api'
  readonly start: (input: LearnerGazeStartInput) => Promise<LearnerGazeSession>
  readonly end: (
    gazeSessionId: string,
    studentId: string,
    endStatus: LearnerGazeEndStatus,
    data?: unknown,
  ) => Promise<LearnerGazeSession>
  readonly fail: (gazeSessionId: string, studentId: string) => Promise<void>
  readonly saveAnalysis: (
    gazeSessionId: string,
    input: LearnerGazeAnalysisInput,
  ) => Promise<string>
}
