/**
 * 아동 화면의 호환성 facade.
 *
 * 화면은 이 모듈의 UI 모델만 사용하고 Spring DTO와 인증 토큰을 직접 다루지 않는다.
 * 실제 구현 선택은 features/learner의 mock/API repository에서 담당한다.
 */
import { learnerDataSource } from '@/config/learnerDataSource'
import { learnerContentRepository } from '@/features/learner/content'
import type {
  LearnerCurrentCurriculum,
  LearnerDeviceStatus,
  LearnerGazeCalibrationGuide,
  LearnerGrowthArea,
  LearnerStudent,
  LearnerStoryDetail,
  LearnerStoryFriend,
  LearnerStoryLibrary,
} from '@/features/learner/model'
import { learnerRuntimeMock } from '@/mocks/learnerRuntimeMock'
import { useLearnerSessionStore } from '@/stores/learnerSession'

export type {
  LearnerCurrentCurriculum,
  LearnerGrowthArea,
  LearnerStudent,
  LearnerStoryDetail,
  LearnerStoryFriend,
  LearnerStoryLibrary,
}

function activeStudentId(): string {
  return getCachedStudent().studentId
}

export const getCachedStudent = (): LearnerStudent => {
  try {
    const student = useLearnerSessionStore().student
    if (student) return { ...student }
  } catch {
    // Pinia 설치 전 평가되는 모듈은 아래 mock 기본값을 사용한다.
  }
  return { ...learnerRuntimeMock.auth.linkedStudents[0]! }
}

export const fetchCurrentCurriculum = (): Promise<LearnerCurrentCurriculum> =>
  learnerContentRepository.getCurrentCurriculum(activeStudentId())

export const fetchStoryLibrary = (): Promise<LearnerStoryLibrary> =>
  learnerContentRepository.getStoryLibrary(activeStudentId())

export const getStoryDetail = (storyId: string): Promise<LearnerStoryDetail> =>
  learnerContentRepository.getStoryDetail(activeStudentId(), storyId)

export const startStorySession = (storyTemplateId: string): Promise<string> =>
  learnerContentRepository.startStory(activeStudentId(), storyTemplateId)

export const fetchGrowthAreas = (): Promise<readonly LearnerGrowthArea[]> =>
  learnerContentRepository.getGrowthAreas(activeStudentId())

export const fetchStoryFriends = (): Promise<readonly LearnerStoryFriend[]> =>
  learnerContentRepository.getStoryFriends(activeStudentId())

export const unlockStoryFriend = (storyId: string): Promise<LearnerStoryFriend | null> =>
  learnerContentRepository.unlockStoryFriend(activeStudentId(), storyId)

/**
 * device store의 초기값은 동기적이어야 하므로 보수적인 기본값을 반환한다.
 * 로그인 이후 실제 상태는 repository의 비동기 조회로 갱신한다.
 */
export const getInitialDeviceStatus = (): LearnerDeviceStatus =>
  learnerDataSource === 'mock'
    ? { ...learnerRuntimeMock.deviceStatus }
    : {
        eyeTrackerConnected: false,
        microphoneAvailable: typeof navigator !== 'undefined' && !!navigator.mediaDevices,
        microphoneActive: false,
      }

export const fetchDeviceStatus = (): Promise<LearnerDeviceStatus> =>
  learnerContentRepository.getDeviceStatus(activeStudentId())

export const fetchGazeCalibrationGuide = (): Promise<LearnerGazeCalibrationGuide> =>
  learnerContentRepository.getGazeCalibrationGuide(activeStudentId())

export const personalizeRuntimeValue = <T>(value: T): T => {
  const studentName = getCachedStudent().name
  const visit = (item: unknown): unknown => {
    if (typeof item === 'string') return item.replaceAll('{studentName}', studentName)
    if (Array.isArray(item)) return item.map(visit)
    if (item && typeof item === 'object') {
      return Object.fromEntries(
        Object.entries(item).map(([key, child]) => [key, visit(child)]),
      )
    }
    return item
  }
  return visit(value) as T
}
