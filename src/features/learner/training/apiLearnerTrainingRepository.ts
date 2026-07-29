import { jsonBody } from '@/lib/api'
import { learnerApiClient } from '../learnerApiClient'
import type {
  LearnerTrainingIntro,
  LearnerTrainingQuestionPayload,
  LearnerTrainingRecordingInput,
  LearnerTrainingRepository,
  LearnerTrainingSelectionInput,
} from './repository'

interface TrainingIntroDto {
  readonly trainingId: number
  readonly trainingTemplateId: number
  readonly status: string
  readonly trainingName: string
  readonly generatedData: unknown
  readonly startedAt: string | null
  readonly finishedAt: string | null
}

interface TrainingQuestionDto {
  readonly trainingId: number
  readonly questionNumber: number
  readonly totalQuestions: number
  readonly question: unknown
}

function trainingPath(studentId: string, trainingId: string): string {
  return `/api/app/training/${encodeURIComponent(studentId)}/${encodeURIComponent(trainingId)}`
}

export class ApiLearnerTrainingRepository implements LearnerTrainingRepository {
  readonly source = 'api' as const

  async getIntro(
    studentId: string,
    trainingId: string,
    options: Parameters<LearnerTrainingRepository['getIntro']>[2] = {},
  ): Promise<LearnerTrainingIntro> {
    const response = await learnerApiClient.request<TrainingIntroDto>(
      `${trainingPath(studentId, trainingId)}/intro`,
      { signal: options.signal },
    )
    return {
      ...response,
      trainingId: String(response.trainingId),
      trainingTemplateId: String(response.trainingTemplateId),
    }
  }

  async getQuestion(
    studentId: string,
    trainingId: string,
    questionNumber: number,
    options: Parameters<LearnerTrainingRepository['getQuestion']>[3] = {},
  ): Promise<LearnerTrainingQuestionPayload> {
    const response = await learnerApiClient.request<TrainingQuestionDto>(
      `${trainingPath(studentId, trainingId)}/questions/${questionNumber}`,
      { signal: options.signal },
    )
    return {
      ...response,
      trainingId: String(response.trainingId),
    }
  }

  async start(studentId: string, trainingId: string): Promise<void> {
    await learnerApiClient.request(
      `${trainingPath(studentId, trainingId)}/start`,
      { method: 'POST' },
    )
  }

  async reset(studentId: string, trainingId: string): Promise<void> {
    await learnerApiClient.request(
      `${trainingPath(studentId, trainingId)}/session-reset`,
      { method: 'POST' },
    )
  }

  async saveSelection(
    studentId: string,
    trainingId: string,
    questionNumber: number,
    input: LearnerTrainingSelectionInput,
  ): Promise<void> {
    await learnerApiClient.request(
      `${trainingPath(studentId, trainingId)}/questions/${questionNumber}/responses`,
      { method: 'POST', body: jsonBody(input) },
    )
  }

  async saveRecording(
    studentId: string,
    trainingId: string,
    questionNumber: number,
    input: LearnerTrainingRecordingInput,
  ): Promise<void> {
    const body = new FormData()
    body.append('wordId', String(input.wordId))
    body.append('targetIndex', String(input.targetIndex))
    if (input.tokenIndex !== undefined) body.append('tokenIndex', String(input.tokenIndex))
    body.append('expectedText', input.expectedText)
    body.append('audioFile', input.audioFile)
    if (input.speechStartOffsetMs !== undefined) {
      body.append('speechStartOffsetMs', String(input.speechStartOffsetMs))
    }
    if (input.speechEndOffsetMs !== undefined) {
      body.append('speechEndOffsetMs', String(input.speechEndOffsetMs))
    }
    await learnerApiClient.request(
      `${trainingPath(studentId, trainingId)}/questions/${questionNumber}/recordings`,
      { method: 'POST', body },
    )
  }

  async complete(
    studentId: string,
    trainingId: string,
    result: unknown,
    completedAt: string,
  ): Promise<void> {
    await learnerApiClient.request(
      `${trainingPath(studentId, trainingId)}/complete`,
      {
        method: 'POST',
        body: jsonBody({ result, completedAt }),
      },
    )
  }
}
