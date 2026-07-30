import { jsonBody } from '@/lib/api'
import { learnerApiClient } from '../learnerApiClient'
import type {
  LearnerStoryBranchResult,
  LearnerStoryRepository,
  LearnerStorySpeechResult,
  LearnerStoryTtsResult,
} from './repository'

function storyPath(studentId: string, storyId: string): string {
  return `/api/app/story/${encodeURIComponent(studentId)}/${encodeURIComponent(storyId)}`
}

export class ApiLearnerStoryRepository implements LearnerStoryRepository {
  readonly source = 'api' as const

  async markLineRead(
    studentId: string,
    storyId: string,
    lineId: string,
  ): Promise<void> {
    await learnerApiClient.request(
      `${storyPath(studentId, storyId)}/lines/${encodeURIComponent(lineId)}`,
    )
  }

  async chooseDirection(
    studentId: string,
    storyId: string,
    lineId: string,
    audioFile: File,
  ): Promise<LearnerStoryBranchResult> {
    const body = new FormData()
    body.append('audioFile', audioFile)
    const response = await learnerApiClient.request<{
      transcript: string
      nextLineId: number
      generatedContent: string
      imageUrl: string | null
      progress: number
      status: string
    }>(
      `${storyPath(studentId, storyId)}/lines/${encodeURIComponent(lineId)}/branches`,
      { method: 'POST', body },
    )
    return { ...response, nextLineId: String(response.nextLineId) }
  }

  async transcribeLine(
    studentId: string,
    storyId: string,
    lineId: string,
    audioFile: File,
  ): Promise<LearnerStorySpeechResult> {
    const body = new FormData()
    body.append('lineId', lineId)
    body.append('audioFile', audioFile)
    return learnerApiClient.request(
      `${storyPath(studentId, storyId)}/speech`,
      { method: 'POST', body },
    )
  }

  async synthesizeLine(
    studentId: string,
    storyId: string,
    lineId: string,
  ): Promise<LearnerStoryTtsResult> {
    return learnerApiClient.request(
      `${storyPath(studentId, storyId)}/tts`,
      { method: 'POST', body: jsonBody({ lineId: Number(lineId) }) },
    )
  }

  async downloadAudio(audioUrl: string): Promise<Blob> {
    const result = await learnerApiClient.download(audioUrl)
    return result.blob
  }
}
