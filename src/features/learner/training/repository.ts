import type { LearnerRequestOptions } from '../model'

export interface LearnerTrainingIntro {
  readonly trainingId: string
  readonly trainingTemplateId: string
  readonly status: string
  readonly trainingName: string
  readonly generatedData: unknown
  readonly startedAt: string | null
  readonly finishedAt: string | null
}

export interface LearnerTrainingQuestionPayload {
  readonly trainingId: string
  readonly questionNumber: number
  readonly totalQuestions: number
  readonly question: unknown
}

export interface LearnerTrainingSelectionInput {
  readonly wordId: number
  readonly isCorrect: boolean
  readonly totalScore: number
}

export interface LearnerTrainingRecordingInput {
  readonly wordId: number
  readonly targetIndex: number
  readonly tokenIndex?: number
  readonly expectedText: string
  readonly audioFile: File
  readonly speechStartOffsetMs?: number
  readonly speechEndOffsetMs?: number
}

export interface LearnerTrainingRepository {
  readonly source: 'mock' | 'api'
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
  readonly saveSelection: (
    studentId: string,
    trainingId: string,
    questionNumber: number,
    input: LearnerTrainingSelectionInput,
  ) => Promise<void>
  readonly saveRecording: (
    studentId: string,
    trainingId: string,
    questionNumber: number,
    input: LearnerTrainingRecordingInput,
  ) => Promise<void>
  readonly complete: (
    studentId: string,
    trainingId: string,
    result: unknown,
    completedAt: string,
  ) => Promise<void>
}
