import { learnerRuntimeMock } from '@/mocks/learnerRuntimeMock'
import type { LearnerStoryFriend } from '../model'
import type { LearnerContentRepository } from './repository'

const STORY_FRIEND_UNLOCK_STORAGE_KEY = 'iread-story-friends-unlocked-v1'

function locallyUnlockedIds(): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORY_FRIEND_UNLOCK_STORAGE_KEY) ?? '[]')
    return new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

export class MockLearnerContentRepository implements LearnerContentRepository {
  readonly source = 'mock' as const

  async getCurrentCurriculum() {
    return {
      ...learnerRuntimeMock.currentCurriculum,
      trainings: learnerRuntimeMock.currentCurriculum.trainings.map((item) => ({ ...item })),
    }
  }

  async getStoryLibrary() {
    return {
      stories: learnerRuntimeMock.storyLibrary.stories.map((item) => ({ ...item })),
      templates: learnerRuntimeMock.storyLibrary.templates.map((item) => ({ ...item })),
    }
  }

  async getStoryDetail(_studentId: string, storyId: string) {
    const detail =
      learnerRuntimeMock.storyDetails[storyId as keyof typeof learnerRuntimeMock.storyDetails] ??
      learnerRuntimeMock.storyDetails.alice
    return {
      ...detail,
      pages: detail.pages.map((page) => ({ ...page, lines: [...page.lines] })),
    }
  }

  async startStory(_studentId: string, storyTemplateId: string) {
    return storyTemplateId
  }

  async getGrowthAreas() {
    return learnerRuntimeMock.growthAreas.map((item) => ({ ...item }))
  }

  async getStoryFriends() {
    const unlockedIds = locallyUnlockedIds()
    return learnerRuntimeMock.storyFriends.map((friend) => ({
      ...friend,
      unlocked: friend.unlocked || unlockedIds.has(friend.id),
    }))
  }

  async unlockStoryFriend(_studentId: string, storyId: string) {
    const friend = learnerRuntimeMock.storyFriends.find((item) => item.id === storyId)
    if (!friend) return null
    const unlockedIds = locallyUnlockedIds()
    unlockedIds.add(storyId)
    localStorage.setItem(STORY_FRIEND_UNLOCK_STORAGE_KEY, JSON.stringify([...unlockedIds]))
    return { ...friend, unlocked: true } satisfies LearnerStoryFriend
  }

  async getDeviceStatus() {
    return { ...learnerRuntimeMock.deviceStatus }
  }

  async getGazeCalibrationGuide() {
    return {
      calibrationRequired: true,
      calibrationGuide: '빛나는 점을 차례대로 바라봐 주세요.',
    }
  }
}
