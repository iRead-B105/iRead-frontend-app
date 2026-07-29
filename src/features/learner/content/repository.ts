import type {
  LearnerCurrentCurriculum,
  LearnerDeviceStatus,
  LearnerGrowthArea,
  LearnerRequestOptions,
  LearnerStoryDetail,
  LearnerStoryFriend,
  LearnerStoryLibrary,
} from '../model'

export interface LearnerContentRepository {
  readonly source: 'mock' | 'api'
  readonly getCurrentCurriculum: (
    studentId: string,
    options?: LearnerRequestOptions,
  ) => Promise<LearnerCurrentCurriculum>
  readonly getStoryLibrary: (
    studentId: string,
    options?: LearnerRequestOptions,
  ) => Promise<LearnerStoryLibrary>
  readonly getStoryDetail: (
    studentId: string,
    storyId: string,
    options?: LearnerRequestOptions,
  ) => Promise<LearnerStoryDetail>
  readonly startStory: (
    studentId: string,
    storyTemplateId: string,
  ) => Promise<string>
  readonly getGrowthAreas: (
    studentId: string,
    options?: LearnerRequestOptions,
  ) => Promise<readonly LearnerGrowthArea[]>
  readonly getStoryFriends: (
    studentId: string,
    options?: LearnerRequestOptions,
  ) => Promise<readonly LearnerStoryFriend[]>
  readonly unlockStoryFriend: (
    studentId: string,
    storyId: string,
  ) => Promise<LearnerStoryFriend | null>
  readonly getDeviceStatus: (
    studentId: string,
    options?: LearnerRequestOptions,
  ) => Promise<LearnerDeviceStatus>
}
