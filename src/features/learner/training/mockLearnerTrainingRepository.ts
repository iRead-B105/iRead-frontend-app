import type {
  LearnerTrainingRepository,
} from './repository'

export class MockLearnerTrainingRepository implements LearnerTrainingRepository {
  readonly source = 'mock' as const

  async getIntro(_studentId: string, trainingId: string) {
    return {
      trainingId,
      trainingTemplateId: trainingId,
      dailyCurriculumId: 'mock-curriculum',
      sequenceNo: 1,
      status: 'NOT_STARTED',
      trainingName: '목업 훈련',
      generatedData: null,
      completedQuestionNumbers: [],
      startedAt: null,
      finishedAt: null,
    }
  }

  async getQuestion(_studentId: string, trainingId: string, questionNumber: number) {
    return { trainingId, questionNumber, totalQuestions: 0, question: null }
  }

  async start(): Promise<void> {}
  async reset(): Promise<void> {}
  async resetPronunciationAttempts(): Promise<void> {}
  async saveSubmission(_studentId: string, _trainingId: string, _questionNumber: number, input: { submissionId: string }) {
    return {
      submissionId: input.submissionId,
      attemptNo: 1,
      maxAttempts: 2,
      remainingAttempts: 1,
      correct: true,
      questionCompleted: true,
      canRetry: false,
      hint: null,
      correctResponse: null,
    }
  }
  async saveRecording() {
    return {
      trainingId: 'mock-training',
      questionNumber: 1,
      pronunciationAccuracyScore: 100,
      pronunciationThreshold: 70,
      attemptNo: 1,
      maxAttempts: 2,
      passed: true,
      questionCompleted: true,
      canRetry: false,
      words: [],
    }
  }
  async complete(): Promise<void> {}
}
