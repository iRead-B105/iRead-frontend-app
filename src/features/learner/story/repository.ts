export interface LearnerStoryBranchResult {
  readonly transcript: string
  readonly nextLineId: string
  readonly generatedContent: string
  readonly imageUrl: string | null
  readonly progress: number
  readonly status: string
}

export interface LearnerStorySpeechResult {
  readonly transcript: string
  readonly accuracy: number
  readonly readingStatus: string
}

export interface LearnerStoryTtsResult {
  readonly audioUrl: string
  readonly durationMs: number
  readonly playbackLimit: number | null
}

export interface LearnerStoryRepository {
  readonly source: 'mock' | 'api'
  readonly chooseDirection: (
    studentId: string,
    storyId: string,
    lineId: string,
    audioFile: File,
  ) => Promise<LearnerStoryBranchResult>
  readonly transcribeLine: (
    studentId: string,
    storyId: string,
    lineId: string,
    audioFile: File,
  ) => Promise<LearnerStorySpeechResult>
  readonly synthesizeLine: (
    studentId: string,
    storyId: string,
    lineId: string,
  ) => Promise<LearnerStoryTtsResult>
}
