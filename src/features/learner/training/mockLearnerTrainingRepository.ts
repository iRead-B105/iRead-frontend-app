import type {
  LearnerTrainingRepository,
} from './repository'

export class MockLearnerTrainingRepository implements LearnerTrainingRepository {
  readonly source = 'mock' as const

  async getIntro(_studentId: string, trainingId: string) {
    return {
      trainingId,
      trainingTemplateId: trainingId,
      status: 'NOT_STARTED',
      trainingName: '목업 훈련',
      generatedData: null,
      startedAt: null,
      finishedAt: null,
    }
  }

  async getQuestion(_studentId: string, trainingId: string, questionNumber: number) {
    return { trainingId, questionNumber, totalQuestions: 0, question: null }
  }

  async start(): Promise<void> {}
  async reset(): Promise<void> {}
  async saveSelection(): Promise<void> {}
  async saveRecording(): Promise<void> {}
  async complete(): Promise<void> {}
}
