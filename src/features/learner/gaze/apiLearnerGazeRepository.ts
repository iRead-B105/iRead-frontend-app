import { jsonBody } from '@/lib/api'
import { learnerApiClient } from '../learnerApiClient'
import type {
  LearnerGazeRepository,
  LearnerGazeSession,
  LearnerGazeStartInput,
} from './repository'

interface GazeSessionDto {
  readonly gazeSessionId: number
  readonly collectionStatus: string
  readonly calibrationStatus: LearnerGazeSession['calibrationStatus']
  readonly startedAt: string
  readonly endedAt: string | null
}

interface CollectedGazeData {
  readonly samples?: readonly unknown[]
  readonly words?: readonly {
    readonly questionNo?: number
    readonly targetIndex?: number
    readonly tokenIndex?: number
    readonly text?: string
    readonly dwellMs?: number
    readonly visitCount?: number
    readonly skipped?: boolean
    readonly regressionCount?: number
    readonly firstSeenMs?: number
    readonly lastSeenMs?: number
  }[]
}

function analysisBody(studentId: string, data: CollectedGazeData) {
  const words = data.words ?? []
  const totalVisitedDuration = words.reduce((sum, word) => sum + (word.dwellMs ?? 0), 0)
  const totalVisitedCount = words.reduce((sum, word) => sum + (word.visitCount ?? 0), 0)
  const reverseReadCount = words.reduce((sum, word) => sum + (word.regressionCount ?? 0), 0)
  return {
    studentId: Number(studentId),
    totalVisitedDuration,
    totalVisitedCount,
    reverseReadCount,
    avgVisitedDuration: totalVisitedCount > 0
      ? Math.round(totalVisitedDuration / totalVisitedCount)
      : 0,
    wordAttempts: words.map((word) => ({
      useLocation: 'TRAINING',
      targetIndex: word.targetIndex ?? 0,
      tokenIndex: word.tokenIndex ?? 0,
      surfaceText: word.text ?? '-',
      hasGazeData: (word.visitCount ?? 0) > 0,
      fixationDurationMs: word.dwellMs ?? 0,
      fixationCount: word.visitCount ?? 0,
      gazeStartOffsetMs: word.firstSeenMs ?? 0,
      gazeEndOffsetMs: word.lastSeenMs ?? 0,
      isSkipped: word.skipped ?? (word.visitCount ?? 0) === 0,
      regressionCount: word.regressionCount ?? 0,
      questionNo: word.questionNo,
      isFinal: true,
    })),
    analysisMeta: {
      contentType: 'TRAINING',
      calculationSource: 'FRONTEND_GAZE_BRIDGE_V1',
    },
  }
}

function toSession(response: GazeSessionDto): LearnerGazeSession {
  return { ...response, gazeSessionId: String(response.gazeSessionId) }
}

export class ApiLearnerGazeRepository implements LearnerGazeRepository {
  readonly source = 'api' as const

  async start(input: LearnerGazeStartInput): Promise<LearnerGazeSession> {
    const response = await learnerApiClient.request<GazeSessionDto>(
      '/api/app/gaze/sessions',
      {
        method: 'POST',
        body: jsonBody({
          ...input,
          studentId: Number(input.studentId),
          testId: input.testId ? Number(input.testId) : undefined,
          trainingId: input.trainingId ? Number(input.trainingId) : undefined,
          storyId: input.storyId ? Number(input.storyId) : undefined,
        }),
      },
    )
    return toSession(response)
  }

  async end(
    gazeSessionId: string,
    studentId: string,
    endStatus: 'COMPLETED' | 'FAILED',
    data?: unknown,
  ): Promise<LearnerGazeSession> {
    const response = await learnerApiClient.request<GazeSessionDto>(
      `/api/app/gaze/sessions/${encodeURIComponent(gazeSessionId)}/end`,
      {
        method: 'PATCH',
        body: jsonBody({ studentId: Number(studentId), endStatus, data }),
      },
    )
    if (endStatus === 'COMPLETED' && data && typeof data === 'object') {
      await learnerApiClient.request(
        `/api/app/gaze/sessions/${encodeURIComponent(gazeSessionId)}/analysis-results`,
        {
          method: 'POST',
          body: jsonBody(analysisBody(studentId, data as CollectedGazeData)),
        },
      )
    }
    return toSession(response)
  }

  async fail(gazeSessionId: string, studentId: string): Promise<void> {
    await learnerApiClient.request(
      `/api/app/gaze/sessions/${encodeURIComponent(gazeSessionId)}/failed`,
      {
        method: 'PATCH',
        body: jsonBody({ studentId: Number(studentId) }),
      },
    )
  }
}
