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
  readonly decision: 'ALLOW' | 'CONFIRM' | 'RETRY' | 'BLOCK'
  readonly reasonCode:
    | 'OK'
    | 'AMBIGUOUS'
    | 'OFF_TOPIC'
    | 'SELF_HARM'
    | 'SEXUAL'
    | 'SEVERE_VIOLENCE'
    | 'THREAT'
    | 'HATE_HARASSMENT'
    | 'PII'
    | 'INJECTION'
  readonly policyVersion: string
  readonly reviewToken: string | null
}

export interface LearnerStoryReviewedBranchAnswer {
  readonly branchIntent: string
  readonly reviewToken: string
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
    answer: number | LearnerStoryReviewedBranchAnswer,
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
