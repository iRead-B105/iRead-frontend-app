import fallbackCover from '@/assets/story/ui/new-book-icon.png'
import fallbackScene from '@/assets/story/story-reader-turtle-scene-mock.png'
import { learnerApiClient } from '../learnerApiClient'
import { LearnerContractUnavailableError } from '../integrationError'
import type {
  LearnerCurrentCurriculum,
  LearnerDeviceStatus,
  LearnerGrowthArea,
  LearnerStoryDetail,
  LearnerStoryFriend,
  LearnerStoryLibrary,
} from '../model'
import type { LearnerContentRepository } from './repository'

interface StoryShelfDto {
  readonly stories: readonly {
    readonly storyId: number
    readonly storyTemplateId: number
    readonly createdAt: string
    readonly storyStatus: 'UNREAD' | 'IN_PROGRESS' | 'COMPLETED'
  }[]
  readonly storyTemplates: readonly {
    readonly storyTemplateId: number
    readonly templateTitle: string
  }[]
}

interface StoryLinesDto {
  readonly storyLines: readonly {
    readonly lineId: number
    readonly storyId: number
    readonly imageUrl: string | null
    readonly requiresBranchInput: boolean
    readonly lineText: string
    readonly lineOrder: number
    readonly readAt: string | null
  }[]
}

interface StorySessionDto {
  readonly storyId: number
}

interface CharacterListDto {
  readonly characters: readonly {
    readonly characterId: number
    readonly storyId: number
    readonly imageUrl: string
    readonly name: string
  }[]
}

interface GazeDeviceStatusDto {
  readonly connected: boolean
}

export class ApiLearnerContentRepository implements LearnerContentRepository {
  readonly source = 'api' as const

  async getCurrentCurriculum(_studentId: string): Promise<LearnerCurrentCurriculum> {
    throw new LearnerContractUnavailableError(
      'LEARNER_CURRENT_CURRICULUM_CONTRACT_REQUIRED',
      '학습 앱 권한으로 현재 커리큘럼을 조회하는 백엔드 계약이 필요합니다.',
    )
  }

  async getStoryLibrary(
    studentId: string,
    options: Parameters<LearnerContentRepository['getStoryLibrary']>[1] = {},
  ): Promise<LearnerStoryLibrary> {
    const response = await learnerApiClient.request<StoryShelfDto>(
      `/api/app/story/${encodeURIComponent(studentId)}`,
      { signal: options.signal },
    )
    const templates = new Map(
      response.storyTemplates.map((template) => [
        String(template.storyTemplateId),
        template,
      ]),
    )

    return {
      templates: response.storyTemplates.map((template) => ({
        templateId: String(template.storyTemplateId),
        title: template.templateTitle,
        coverImageUrl: fallbackCover,
      })),
      stories: response.stories.map((story, index) => {
        const template = templates.get(String(story.storyTemplateId))
        return {
          storyId: String(story.storyId),
          templateId: String(story.storyTemplateId),
          sessionNumber: index + 1,
          createdAt: story.createdAt,
          lastReadAt: null,
          title: template?.templateTitle ?? '나의 이야기',
          coverImageUrl: fallbackCover,
          status: story.storyStatus,
          progress: story.storyStatus === 'COMPLETED' ? 100 : 0,
        }
      }),
    }
  }

  async getStoryDetail(
    studentId: string,
    storyId: string,
    options: Parameters<LearnerContentRepository['getStoryDetail']>[2] = {},
  ): Promise<LearnerStoryDetail> {
    const response = await learnerApiClient.request<StoryLinesDto>(
      `/api/app/story/${encodeURIComponent(studentId)}/${encodeURIComponent(storyId)}/lines`,
      { signal: options.signal },
    )
    return {
      storyId,
      title: '나의 이야기',
      character: '이야기 친구',
      branchQuestion: '다음에는 어떤 일이 일어날까요?',
      pages: [...response.storyLines]
        .sort((left, right) => left.lineOrder - right.lineOrder)
        .map((line) => ({
          lineId: String(line.lineId),
          order: line.lineOrder,
          lines: [line.lineText],
          imageUrl: line.imageUrl || fallbackScene,
          readAt: line.readAt,
          requiresBranchInput: line.requiresBranchInput,
        })),
    }
  }

  async startStory(studentId: string, storyTemplateId: string): Promise<string> {
    const response = await learnerApiClient.request<StorySessionDto>(
      `/api/app/story/${encodeURIComponent(studentId)}/${encodeURIComponent(storyTemplateId)}/sessions`,
      { method: 'POST' },
    )
    return String(response.storyId)
  }

  async getGrowthAreas(_studentId: string): Promise<readonly LearnerGrowthArea[]> {
    throw new LearnerContractUnavailableError(
      'LEARNER_GROWTH_MAPPING_REQUIRED',
      '훈련 템플릿별 완료 횟수를 세 성장 영역과 단계로 변환하는 제품 규칙이 필요합니다.',
    )
  }

  async getStoryFriends(
    _studentId: string,
    options: Parameters<LearnerContentRepository['getStoryFriends']>[1] = {},
  ): Promise<readonly LearnerStoryFriend[]> {
    const response = await learnerApiClient.request<CharacterListDto>(
      '/api/app/mypage/character',
      { signal: options.signal },
    )
    return response.characters.map((character) => ({
      id: String(character.storyId),
      name: character.name,
      image: character.imageUrl,
      kind: 'character',
      unlocked: true,
    }))
  }

  async unlockStoryFriend(
    studentId: string,
    storyId: string,
  ): Promise<LearnerStoryFriend | null> {
    const friends = await this.getStoryFriends(studentId)
    return friends.find((friend) => friend.id === storyId) ?? null
  }

  async getDeviceStatus(
    studentId: string,
    options: Parameters<LearnerContentRepository['getDeviceStatus']>[1] = {},
  ): Promise<LearnerDeviceStatus> {
    const params = new URLSearchParams({ studentId })
    const response = await learnerApiClient.request<GazeDeviceStatusDto>(
      `/api/app/gaze/device/status?${params.toString()}`,
      { signal: options.signal },
    )
    return {
      eyeTrackerConnected: response.connected,
      microphoneAvailable: typeof navigator !== 'undefined' && !!navigator.mediaDevices,
      microphoneActive: false,
    }
  }
}
