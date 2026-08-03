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

export interface LearnerStoryBranchTranscriptionResult {
  readonly transcript: string
  readonly confidence: number
  readonly accepted: boolean
}

export interface LearnerStoryTtsResult {
  readonly audioUrl: string
  readonly durationMs: number
  readonly playbackLimit: number | null
}

export interface LearnerStoryRepository {
  readonly source: 'mock' | 'api'
  readonly markLineRead: (
    studentId: string,
    storyId: string,
    lineId: string,
  ) => Promise<void>
  readonly chooseDirection: (
    studentId: string,
    storyId: string,
    lineId: string,
    answer: string | number,
  ) => Promise<LearnerStoryBranchResult>
  readonly transcribeBranchIntent: (
    studentId: string,
    storyId: string,
    lineId: string,
    audioFile: File,
  ) => Promise<LearnerStoryBranchTranscriptionResult>
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
  readonly downloadAudio: (audioUrl: string) => Promise<Blob>
}
