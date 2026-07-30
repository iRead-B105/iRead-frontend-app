import type { LearnerStoryRepository } from './repository'

export class MockLearnerStoryRepository implements LearnerStoryRepository {
  readonly source = 'mock' as const

  async markLineRead() {}

  async chooseDirection(
    _studentId: string,
    _storyId: string,
    lineId: string,
  ) {
    return {
      transcript: '',
      nextLineId: lineId,
      generatedContent: '',
      imageUrl: null,
      progress: 0,
      status: 'IN_PROGRESS',
    }
  }

  async transcribeLine() {
    return { transcript: '', accuracy: 0, readingStatus: 'MOCK' }
  }

  async synthesizeLine() {
    return { audioUrl: '', durationMs: 0, playbackLimit: null }
  }

  async downloadAudio() {
    return new Blob()
  }
}
