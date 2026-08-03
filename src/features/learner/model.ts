import type { TrainingCategoryId } from '@/types/training'
import type { VillageItem } from '@/types/village'

export interface LearnerStudent {
  readonly studentId: string
  readonly name: string
  readonly age: number | null
  readonly profileColor: string
  readonly profileImageUrl: string | null
}

export interface LearnerTeacherLoginInput {
  readonly email: string
  readonly password: string
}

export interface LearnerTeacherBootstrap {
  readonly teacherId: string
  readonly bootstrapToken: string
  readonly linkedStudents: readonly LearnerStudent[]
  readonly expiresIn: number
}

export interface LearnerLoginSession {
  readonly studentId: string
  readonly accessToken: string
  readonly expiresIn: number
}

export type LearnerCurriculumStatus = 'PREPARING' | 'READY' | 'REST' | 'COMPLETED'
export type LearnerTrainingStatus = 'COMPLETED' | 'CURRENT' | 'LOCKED'

export interface LearnerCurriculumTraining {
  readonly trainingId: string
  readonly trainingTemplateId: string
  readonly order: number
  readonly categoryId: TrainingCategoryId
  readonly lessonId: string
  readonly unitName: string
  readonly name: string
  readonly status: LearnerTrainingStatus
}

export interface LearnerCurrentCurriculum {
  readonly curriculumId: string
  readonly studyDate: string | null
  readonly status: LearnerCurriculumStatus
  readonly currentOrder: number
  readonly trainings: readonly LearnerCurriculumTraining[]
}

export type LearnerStoryStatus = 'UNREAD' | 'IN_PROGRESS' | 'COMPLETED'

export interface LearnerStoryTemplate {
  readonly templateId: string
  readonly title: string
  readonly coverImageUrl: string
}

export interface LearnerStorySession {
  readonly storyId: string
  readonly templateId: string
  readonly sessionNumber: number
  readonly createdAt: string
  readonly lastReadAt: string | null
  readonly title: string
  readonly latestBranchSubtitle: string
  readonly coverImageUrl: string
  readonly status: LearnerStoryStatus
  readonly progress: number
}

export interface LearnerStoryLibrary {
  readonly stories: readonly LearnerStorySession[]
  readonly templates: readonly LearnerStoryTemplate[]
}

export interface LearnerStoryBranchOption {
  readonly optionNo: 1 | 2 | 3
  readonly label: string
}

export interface LearnerStoryBranchPrompt {
  readonly subtitle: string
  readonly options: readonly LearnerStoryBranchOption[]
}

export interface LearnerStoryPage {
  readonly lineId: string
  readonly order: number
  readonly lines: readonly string[]
  readonly imageUrl: string
  readonly imagePosition?: string
  readonly readAt: string | null
  readonly requiresBranchInput: boolean
  readonly branchPrompt: LearnerStoryBranchPrompt | null
}

export interface LearnerStoryDetail {
  readonly storyId: string
  readonly title: string
  readonly character: string
  readonly branchQuestion: string
  readonly status: LearnerStoryStatus
  readonly currentDay: number
  readonly availableDay: number
  readonly totalDays: number
  readonly pagesPerDay: number
  readonly dayComplete: boolean
  readonly pages: readonly LearnerStoryPage[]
}

export interface LearnerGrowthArea {
  readonly areaId: 1 | 2 | 3
  readonly name: string
  readonly learningCount: number
  readonly stage: number
  readonly updatedAt: string
}

export interface LearnerDeviceStatus {
  readonly eyeTrackerConnected: boolean
  readonly microphoneAvailable: boolean
  readonly microphoneActive: boolean
}

export interface LearnerGazeCalibrationGuide {
  readonly calibrationRequired: boolean
  readonly calibrationGuide: string
}

export type LearnerStoryFriend = VillageItem

export interface LearnerRequestOptions {
  readonly signal?: AbortSignal
}
