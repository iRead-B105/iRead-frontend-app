import fallbackCover from '@/assets/story/ui/new-book-icon.png'
import fallbackScene from '@/assets/story/story-reader-turtle-scene-mock.png'
import { learnerApiClient } from '../learnerApiClient'
import { getGrowthAreaId, resolveTrainingMapping } from './trainingTemplateMapping'
import type {
  LearnerCurrentCurriculum,
  LearnerDeviceStatus,
  LearnerGazeCalibrationGuide,
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
    readonly progress: number
  }[]
  readonly storyTemplates: readonly {
    readonly storyTemplateId: number
    readonly templateTitle: string
    readonly imageUrl: string | null
  }[]
}

interface StoryLinesDto {
  readonly storyId: number
  readonly storyStatus: 'UNREAD' | 'IN_PROGRESS' | 'COMPLETED'
  readonly currentDay: number
  readonly availableDay: number
  readonly totalDays: number
  readonly pagesPerDay: number
  readonly dayComplete: boolean
  readonly storyLines: readonly {
    readonly lineId: number
    readonly storyId: number
    readonly imageUrl: string | null
    readonly requiresBranchInput: boolean
    readonly lineText: string
    readonly sceneOrder?: number
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
    readonly storyTitle: string
    readonly imageUrl: string
    readonly name: string
  }[]
}

interface GazeDeviceStatusDto {
  readonly connected: boolean
}

interface CurrentTrainingListDto {
  readonly curriculumId: number
  readonly studyDate?: string | null
  readonly curriculumStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  readonly trainings: readonly {
    readonly trainingId: number
    readonly trainingTemplateId: number
    readonly trainingType?: string
    readonly sequenceNo: number
    readonly unitName: string
    readonly trainingName: string
    readonly status: 'NOT_READY' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  }[]
}

interface GrowthDto {
  readonly trainingProgress: readonly {
    readonly trainingTemplateId: number
    readonly trainingTemplateName: string
    readonly completedCount: number
  }[]
  readonly growthAreas?: readonly {
    readonly areaId: 1 | 2 | 3
    readonly name: string
    readonly stage: number
    readonly completedCount: number
    readonly updatedAt: string | null
  }[]
}

export class ApiLearnerContentRepository implements LearnerContentRepository {
  readonly source = 'api' as const

  async getCurrentCurriculum(
    studentId: string,
    options: Parameters<LearnerContentRepository['getCurrentCurriculum']>[1] = {},
  ): Promise<LearnerCurrentCurriculum> {
    const response = await learnerApiClient.request<CurrentTrainingListDto>(
      `/api/app/training/${encodeURIComponent(studentId)}`,
      { signal: options.signal },
    )
    const orderedTrainings = [...response.trainings].sort(
      (left, right) => left.sequenceNo - right.sequenceNo,
    )
    const explicitlyCurrent = orderedTrainings.find((training) => (
      training.status === 'NOT_STARTED' || training.status === 'IN_PROGRESS'
    ))
    const allCompleted = orderedTrainings.length > 0
      && orderedTrainings.every((training) => training.status === 'COMPLETED')
    const current = explicitlyCurrent
      ?? (allCompleted
        ? undefined
        : orderedTrainings.find((training) => training.status !== 'COMPLETED'))

    return {
      curriculumId: String(response.curriculumId),
      studyDate: response.studyDate ?? null,
      status: response.curriculumStatus === 'COMPLETED' || allCompleted ? 'COMPLETED' : 'READY',
      currentOrder: current?.sequenceNo ?? orderedTrainings.length + 1,
      trainings: orderedTrainings.map((training) => {
        const mapping = resolveTrainingMapping(
          training.trainingType,
          training.trainingTemplateId,
        )
        if (!mapping) {
          throw new TypeError(
            `[아동 훈련 계약] trainingType=${training.trainingType ?? 'MISSING'}, `
            + `trainingTemplateId=${training.trainingTemplateId}의 화면 매핑이 없습니다.`,
          )
        }
        return {
          trainingId: String(training.trainingId),
          trainingTemplateId: String(training.trainingTemplateId),
          order: training.sequenceNo,
          categoryId: mapping.categoryId,
          lessonId: mapping.lessonId,
          unitName: training.unitName,
          name: training.trainingName,
          status: training.status === 'COMPLETED'
            ? 'COMPLETED' as const
            : training.trainingId === current?.trainingId
              ? 'CURRENT' as const
              : 'LOCKED' as const,
        }
      }),
    }
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
        coverImageUrl: template.imageUrl || fallbackCover,
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
          coverImageUrl: template?.imageUrl || fallbackCover,
          status: story.storyStatus,
          progress: story.progress,
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
      status: response.storyStatus,
      currentDay: response.currentDay,
      availableDay: response.availableDay,
      totalDays: response.totalDays,
      pagesPerDay: response.pagesPerDay,
      dayComplete: response.dayComplete,
      pages: [...response.storyLines]
        .sort((left, right) => (
          (left.sceneOrder ?? 0) - (right.sceneOrder ?? 0)
          || left.lineOrder - right.lineOrder
        ))
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

  async getGrowthAreas(
    studentId: string,
    options: Parameters<LearnerContentRepository['getGrowthAreas']>[1] = {},
  ): Promise<readonly LearnerGrowthArea[]> {
    const response = await learnerApiClient.request<GrowthDto>(
      `/api/app/student/${encodeURIComponent(studentId)}/growth`,
      { signal: options.signal },
    )
    if (response.growthAreas) {
      return response.growthAreas.map((area) => ({
        areaId: area.areaId,
        name: area.name,
        learningCount: area.completedCount,
        stage: Math.min(5, Math.max(1, area.stage)),
        updatedAt: area.updatedAt ?? '',
      }))
    }

    // 구버전 Backend 응답과의 순차 배포 호환용이다. 새 Backend에서는 growthAreas를 사용한다.
    const learningCounts: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 }
    response.trainingProgress.forEach((progress) => {
      const areaId = getGrowthAreaId(progress.trainingTemplateId)
      if (areaId) learningCounts[areaId] += progress.completedCount
    })
    const names: Record<1 | 2 | 3, string> = {
      1: '파닉스',
      2: '읽기',
      3: '유창성',
    }

    return ([1, 2, 3] as const).map((areaId) => ({
      areaId,
      name: names[areaId],
      learningCount: learningCounts[areaId],
      stage: Math.min(5, Math.max(1, learningCounts[areaId] + 1)),
      updatedAt: '',
    }))
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
      storyTitle: character.storyTitle,
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

  async getGazeCalibrationGuide(
    studentId: string,
    options: Parameters<LearnerContentRepository['getGazeCalibrationGuide']>[1] = {},
  ): Promise<LearnerGazeCalibrationGuide> {
    const params = new URLSearchParams({ studentId })
    return learnerApiClient.request(
      `/api/app/gaze/calibration-guide?${params.toString()}`,
      { signal: options.signal },
    )
  }
}
