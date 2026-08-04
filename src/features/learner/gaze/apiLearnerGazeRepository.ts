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
  readonly contentType?: 'TEST' | 'TRAINING' | 'STORY'
  readonly storyId?: number
  readonly trainingId?: number
  readonly testId?: number
  readonly gazeSessionDurationMs?: number
  readonly samples?: readonly unknown[]
  readonly sentenceMetrics?: readonly {
    readonly storyLineId?: number
    readonly sequenceNo?: number
    readonly surfaceText?: string
    readonly dwellDurationMs?: number
    readonly fixationCount?: number
    readonly regressionCount?: number
    readonly averageFixationTimeMs?: number
    readonly firstGazeOffsetMs?: number
    readonly lastGazeOffsetMs?: number
  }[]
  readonly regressions?: readonly {
    readonly fromTargetIndex: number
    readonly fromTokenIndex: number
    readonly toTargetIndex: number
    readonly toTokenIndex: number
    readonly offsetMs: number
  }[]
  readonly words?: readonly {
    readonly questionNo?: number
    readonly targetIndex?: number
    readonly tokenIndex?: number
    readonly storyLineId?: number
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
  const sentenceMetrics = data.sentenceMetrics ?? []
  const contentType = data.contentType ?? 'TRAINING'
  const totalVisitedDuration = words.reduce((sum, word) => sum + (word.dwellMs ?? 0), 0)
    + sentenceMetrics.reduce((sum, metric) => sum + (metric.dwellDurationMs ?? 0), 0)
  const totalVisitedCount = words.reduce((sum, word) => sum + (word.visitCount ?? 0), 0)
    + sentenceMetrics.reduce((sum, metric) => sum + (metric.fixationCount ?? 0), 0)
  const reverseReadCount = words.reduce((sum, word) => sum + (word.regressionCount ?? 0), 0)
    + (data.regressions?.length ?? 0)
  return {
    studentId: Number(studentId),
    totalVisitedDuration,
    totalVisitedCount,
    reverseReadCount,
    avgVisitedDuration: totalVisitedCount > 0
      ? Math.round(totalVisitedDuration / totalVisitedCount)
      : 0,
    ...(contentType === 'STORY' && sentenceMetrics.length > 0
      ? {
          sentenceMetrics: sentenceMetrics.map((metric) => ({
            storyLineId: metric.storyLineId,
            sequenceNo: metric.sequenceNo,
            surfaceText: metric.surfaceText ?? '-',
            dwellDurationMs: metric.dwellDurationMs ?? 0,
            fixationCount: metric.fixationCount ?? 0,
            regressionCount: metric.regressionCount ?? 0,
            averageFixationTimeMs: metric.averageFixationTimeMs,
            firstGazeOffsetMs: metric.firstGazeOffsetMs ?? 0,
            lastGazeOffsetMs: metric.lastGazeOffsetMs ?? 0,
          })),
        }
      : {}),
    wordAttempts: words.map((word) => ({
      useLocation: contentType,
      storyLineId: word.storyLineId,
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
    regressions: [...(data.regressions ?? [])],
    analysisMeta: {
      contentType,
      storyId: data.storyId,
      trainingId: data.trainingId,
      testId: data.testId,
      calculationSource: 'FRONTEND_GAZE_BRIDGE_V1',
      gazeSessionDurationMs: data.gazeSessionDurationMs,
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
      try {
        await learnerApiClient.request(
          `/api/app/gaze/sessions/${encodeURIComponent(gazeSessionId)}/analysis-results`,
          {
            method: 'POST',
            body: jsonBody(analysisBody(studentId, data as CollectedGazeData)),
          },
          { suppressErrorHandler: true },
        )
      } catch (error) {
        console.warn('[gaze] 세션 종료 후 분석 결과 저장에 실패했습니다.', error)
      }
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
