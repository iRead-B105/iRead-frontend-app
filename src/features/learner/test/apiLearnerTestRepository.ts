import { jsonBody } from '@/lib/api'
import { learnerApiClient } from '../learnerApiClient'
import type {
  LearnerTrainingFeedback,
  LearnerTrainingIntro,
  LearnerTrainingQuestionPayload,
  LearnerTrainingRecordingInput,
  LearnerTrainingRecordingResult,
  LearnerTrainingSubmissionInput,
} from '@/features/learner/training'
import type { LearnerSkillChallengePlan, LearnerTestRepository } from './repository'

interface ChallengePlanDto extends Omit<
  LearnerSkillChallengePlan,
  'testCurriculumId' | 'nextTestId' | 'tracks'
> {
  readonly testCurriculumId: string
  readonly nextTestId: string | null
  readonly tracks: readonly (Omit<LearnerSkillChallengePlan['tracks'][number], 'nextTestId'> & {
    readonly nextTestId: string | null
  })[]
}

interface TestIntroDto {
  readonly testId: number
  readonly trainingTemplateId: number
  readonly sequenceNo: number
  readonly trainingName: string
  readonly generatedData: unknown
  readonly createdAt: string
  readonly status: string
}

interface TestQuestionDto {
  readonly testId: number
  readonly questionNumber: number
  readonly totalQuestions: number
  readonly question: unknown
}

interface TestProgressDto {
  readonly submissionId: string
  readonly accepted: boolean
}

interface TestRecordingDto extends Omit<LearnerTrainingRecordingResult, 'trainingId'> {
  readonly testId: number
}

const testPath = (studentId: string): string =>
  `/api/app/test/${encodeURIComponent(studentId)}`

export class ApiLearnerTestRepository implements LearnerTestRepository {
  readonly source = 'api' as const

  async getChallengePlan(studentId: string): Promise<LearnerSkillChallengePlan> {
    const response = await learnerApiClient.request<ChallengePlanDto>(
      `${testPath(studentId)}/challenge`,
    )
    return {
      ...response,
      testCurriculumId: String(response.testCurriculumId),
      nextTestId: response.nextTestId === null ? null : String(response.nextTestId),
      tracks: response.tracks.map((track) => ({
        ...track,
        nextTestId: track.nextTestId === null ? null : String(track.nextTestId),
      })),
    }
  }

  async getIntro(studentId: string, testId: string): Promise<LearnerTrainingIntro> {
    const response = await learnerApiClient.request<TestIntroDto>(
      `${testPath(studentId)}/intro?testId=${encodeURIComponent(testId)}`,
    )
    return {
      trainingId: String(response.testId),
      trainingTemplateId: String(response.trainingTemplateId),
      dailyCurriculumId: 'skill-challenge',
      sequenceNo: response.sequenceNo,
      status: response.status,
      trainingName: response.trainingName,
      generatedData: response.generatedData,
      completedQuestionNumbers: [],
      startedAt: response.status === 'NOT_STARTED' ? null : response.createdAt,
      finishedAt: response.status === 'COMPLETED' ? response.createdAt : null,
    }
  }

  async getQuestion(
    studentId: string,
    testId: string,
    questionNumber: number,
  ): Promise<LearnerTrainingQuestionPayload> {
    const response = await learnerApiClient.request<TestQuestionDto>(
      `${testPath(studentId)}/questions/${questionNumber}?testId=${encodeURIComponent(testId)}`,
    )
    return {
      trainingId: String(response.testId),
      questionNumber: response.questionNumber,
      totalQuestions: response.totalQuestions,
      question: response.question,
    }
  }

  async start(studentId: string, testId: string): Promise<void> {
    await learnerApiClient.request(`${testPath(studentId)}/start`, {
      method: 'POST',
      body: jsonBody({ testId }),
    })
  }

  async reset(studentId: string, testId: string): Promise<void> {
    await learnerApiClient.request(`${testPath(studentId)}/session-reset`, {
      method: 'POST',
      body: jsonBody({ testId }),
    })
  }

  async saveSubmission(
    studentId: string,
    testId: string,
    questionNumber: number,
    input: LearnerTrainingSubmissionInput,
  ): Promise<LearnerTrainingFeedback> {
    const response = await learnerApiClient.request<TestProgressDto>(
      `${testPath(studentId)}/questions/${questionNumber}/responses`,
      {
        method: 'POST',
        body: jsonBody({ testId, submission: input }),
      },
    )
    return {
      submissionId: response.submissionId,
      attemptNo: 1,
      maxAttempts: 1,
      remainingAttempts: 0,
      correct: response.accepted,
      questionCompleted: response.accepted,
      canRetry: false,
      hint: null,
      correctResponse: null,
    }
  }

  async saveRecording(
    studentId: string,
    testId: string,
    questionNumber: number,
    input: LearnerTrainingRecordingInput,
  ): Promise<LearnerTrainingRecordingResult> {
    const body = new FormData()
    body.append('testId', testId)
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
    const response = await learnerApiClient.request<TestRecordingDto>(
      `${testPath(studentId)}/questions/${questionNumber}/recordings`,
      { method: 'POST', body },
      { suppressErrorHandler: true },
    )
    return { ...response, trainingId: String(response.testId) }
  }

  async complete(studentId: string, testId: string): Promise<void> {
    await learnerApiClient.request(`${testPath(studentId)}/complete`, {
      method: 'POST',
      body: jsonBody({ testId }),
    })
  }
}
