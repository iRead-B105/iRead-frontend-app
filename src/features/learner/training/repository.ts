import type { LearnerRequestOptions } from '../model'

export interface LearnerTrainingIntro {
  readonly trainingId: string
  readonly trainingTemplateId: string
  readonly trainingType?: string
  readonly dailyCurriculumId: string
  readonly sequenceNo: number
  readonly status: string
  readonly trainingName: string
  readonly generatedData: unknown
  readonly completedQuestionNumbers: readonly number[]
  readonly startedAt: string | null
  readonly finishedAt: string | null
}

export interface LearnerTrainingQuestionPayload {
  readonly trainingId: string
  readonly questionNumber: number
  readonly totalQuestions: number
  readonly question: unknown
}

export type LearnerTrainingResponseType =
  | 'TRACE'
  | 'SINGLE_CHOICE'
  | 'ORDERING'
  | 'COMPONENT_BUILD'
  | 'TEXT_INPUT'
  | 'AUDIO'

export interface LearnerTrainingSubmissionInput {
  readonly submissionId: string
  readonly responseType: LearnerTrainingResponseType
  readonly response: Readonly<Record<string, unknown>>
}

export interface LearnerTraceSubmissionResponse {
  readonly canvasWidth: number
  readonly canvasHeight: number
  readonly strokes: readonly {
    readonly points: readonly {
      readonly x: number
      readonly y: number
      readonly elapsedMs: number
      readonly pressure?: number
    }[]
  }[]
}

export interface LearnerTrainingFeedback {
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

export interface LearnerTrainingRecordingResult {
  readonly trainingId: string
  readonly questionNumber: number
  readonly pronunciationAccuracyScore: number
  readonly pronunciationThreshold: number
  readonly attemptNo: number
  readonly maxAttempts: number
  readonly passed: boolean
  readonly questionCompleted: boolean
  readonly canRetry: boolean
  readonly words: readonly {
    readonly surfaceText: string
    readonly pronunciationAccuracyScore: number
    readonly pronunciationErrorType: string
  }[]
}

export interface LearnerTrainingRecordingInput {
  readonly wordId?: number
  readonly targetIndex?: number
  readonly tokenIndex?: number
  readonly expectedText: string
  readonly audioFile: File
  readonly speechStartOffsetMs?: number
  readonly speechEndOffsetMs?: number
}

export interface LearnerTrainingRepository {
  readonly source: 'api'
  readonly getIntro: (
    studentId: string,
    trainingId: string,
    options?: LearnerRequestOptions,
  ) => Promise<LearnerTrainingIntro>
  readonly getQuestion: (
    studentId: string,
    trainingId: string,
    questionNumber: number,
    options?: LearnerRequestOptions,
  ) => Promise<LearnerTrainingQuestionPayload>
  readonly start: (studentId: string, trainingId: string) => Promise<void>
  readonly reset: (studentId: string, trainingId: string) => Promise<void>
  readonly resetPronunciationAttempts: (studentId: string, trainingId: string) => Promise<void>
  readonly saveSubmission: (
    studentId: string,
    trainingId: string,
    questionNumber: number,
    input: LearnerTrainingSubmissionInput,
  ) => Promise<LearnerTrainingFeedback>
  readonly saveRecording: (
    studentId: string,
    trainingId: string,
    questionNumber: number,
    input: LearnerTrainingRecordingInput,
  ) => Promise<LearnerTrainingRecordingResult>
  readonly complete: (studentId: string, trainingId: string) => Promise<void>
}
