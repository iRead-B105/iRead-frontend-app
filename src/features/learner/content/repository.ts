import type {
  LearnerCurrentCurriculum,
  LearnerDeviceStatus,
  LearnerGrowthArea,
  LearnerGrowthSummary,
  LearnerGazeCalibrationGuide,
  LearnerRequestOptions,
  LearnerStoryDetail,
  LearnerStoryFriend,
  LearnerStoryLibrary,
} from '../model'

export interface LearnerContentRepository {
  readonly source: 'api'
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
  readonly deleteStory: (
    studentId: string,
    storyId: string,
  ) => Promise<void>
  readonly getGrowthAreas: (
    studentId: string,
    options?: LearnerRequestOptions,
  ) => Promise<LearnerGrowthSummary>
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
  readonly getGazeCalibrationGuide: (
    studentId: string,
    options?: LearnerRequestOptions,
  ) => Promise<LearnerGazeCalibrationGuide>
}
