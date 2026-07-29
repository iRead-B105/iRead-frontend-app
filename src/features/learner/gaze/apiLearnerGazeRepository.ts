import { jsonBody } from '@/lib/api'
import { learnerApiClient } from '../learnerApiClient'
import type {
  LearnerGazeAnalysisInput,
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

  async saveAnalysis(
    gazeSessionId: string,
    input: LearnerGazeAnalysisInput,
  ): Promise<string> {
    const response = await learnerApiClient.request<{ gazeAnalysisId: number }>(
      `/api/app/gaze/sessions/${encodeURIComponent(gazeSessionId)}/analysis-results`,
      {
        method: 'POST',
        body: jsonBody({ ...input, studentId: Number(input.studentId) }),
      },
    )
    return String(response.gazeAnalysisId)
  }
}
