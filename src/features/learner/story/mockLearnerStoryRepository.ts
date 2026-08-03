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
      transcript: '용기를 내어 앞으로 가요',
      nextLineId: lineId,
      generatedContent: '친구와 함께 새로운 길을 찾아갔어요.',
      imageUrl: null,
      progress: 100,
      status: 'COMPLETED',
    }
  }

  async transcribeLine() {
    return { transcript: '', accuracy: 0, readingStatus: 'MOCK' }
  }

  async transcribeBranchIntent() {
    return { transcript: '별빛 다리를 건너갈래요', confidence: 0.98, accepted: true }
  }

  async synthesizeLine() {
    return { audioUrl: '', durationMs: 0, playbackLimit: null }
  }

  async downloadAudio() {
    return new Blob()
  }
}
