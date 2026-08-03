import { isAbortError, jsonBody } from '@/lib/api'
import { learnerApiClient } from '../learnerApiClient'
import type {
  LearnerTrainingIntro,
  LearnerTrainingFeedback,
  LearnerTrainingQuestionPayload,
  LearnerTrainingRecordingInput,
  LearnerTrainingRecordingResult,
  LearnerTrainingRepository,
  LearnerTrainingSubmissionInput,
} from './repository'

interface TrainingIntroDto {
  readonly trainingId: number
  readonly trainingTemplateId: number
  readonly trainingType: string
  readonly dailyCurriculumId: number
  readonly sequenceNo: number
  readonly status: string
  readonly trainingName: string
  readonly generatedData: unknown
  readonly completedQuestionNumbers?: readonly number[]
  readonly startedAt: string | null
  readonly finishedAt: string | null
}

interface TrainingQuestionDto {
  readonly trainingId: number
  readonly questionNumber: number
  readonly totalQuestions: number
  readonly question: unknown
}

const TRAINING_COMPLETION_TIMEOUT_MS = 20_000

interface TrainingFeedbackDto {
  readonly submissionId: string
  readonly attemptNo: number
  readonly maxAttempts: number
  readonly remainingAttempts: number
  readonly correct: boolean
  readonly questionCompleted: boolean
  readonly canRetry: boolean
  readonly hint: string | null
  readonly correctResponse: unknown
}

interface TrainingRecordingDto extends Omit<LearnerTrainingRecordingResult, 'trainingId'> {
  readonly trainingId: number
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
      dailyCurriculumId: String(response.dailyCurriculumId),
      completedQuestionNumbers: response.completedQuestionNumbers ?? [],
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

  async resetPronunciationAttempts(studentId: string, trainingId: string): Promise<void> {
    await learnerApiClient.request(
      `${trainingPath(studentId, trainingId)}/pronunciation-attempts/reset`,
      { method: 'POST' },
    )
  }

  async saveSubmission(
    studentId: string,
    trainingId: string,
    questionNumber: number,
    input: LearnerTrainingSubmissionInput,
  ): Promise<LearnerTrainingFeedback> {
    return learnerApiClient.request<TrainingFeedbackDto>(
      `${trainingPath(studentId, trainingId)}/questions/${questionNumber}/responses`,
      { method: 'POST', body: jsonBody(input) },
    )
  }

  async saveRecording(
    studentId: string,
    trainingId: string,
    questionNumber: number,
    input: LearnerTrainingRecordingInput,
  ): Promise<LearnerTrainingRecordingResult> {
    const body = new FormData()
    if (input.wordId !== undefined) body.append('wordId', String(input.wordId))
    if (input.targetIndex !== undefined) body.append('targetIndex', String(input.targetIndex))
    if (input.tokenIndex !== undefined) body.append('tokenIndex', String(input.tokenIndex))
    body.append('expectedText', input.expectedText)
    body.append('audioFile', input.audioFile)
    if (input.speechStartOffsetMs !== undefined) {
      body.append('speechStartOffsetMs', String(input.speechStartOffsetMs))
    }
    if (input.speechEndOffsetMs !== undefined) {
      body.append('speechEndOffsetMs', String(input.speechEndOffsetMs))
    }
    const response = await learnerApiClient.request<TrainingRecordingDto>(
      `${trainingPath(studentId, trainingId)}/questions/${questionNumber}/recordings`,
      { method: 'POST', body },
      { suppressErrorHandler: true },
    )
    return { ...response, trainingId: String(response.trainingId) }
  }

  async complete(studentId: string, trainingId: string): Promise<void> {
    const controller = new AbortController()
    const timeoutId = globalThis.setTimeout(
      () => controller.abort(),
      TRAINING_COMPLETION_TIMEOUT_MS,
    )
    try {
      await learnerApiClient.request(
        `${trainingPath(studentId, trainingId)}/complete`,
        { method: 'POST', signal: controller.signal },
      )
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error('저장이 조금 늦어지고 있어요. 잠시 후 다시 시도해 주세요.')
      }
      throw error
    } finally {
      globalThis.clearTimeout(timeoutId)
    }
  }
}
