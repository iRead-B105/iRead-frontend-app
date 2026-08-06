/**
 * 아동 화면의 호환성 facade.
 *
 * 화면은 이 모듈의 UI 모델만 사용하고 Spring DTO와 인증 토큰을 직접 다루지 않는다.
 * 실제 구현 선택은 features/learner의 mock/API repository에서 담당한다.
 */
import { learnerContentRepository } from '@/features/learner/content'
import { resolveAuthenticatedStoryImage } from '@/features/learner/story/authenticatedStoryImage'
import { preloadStoryImages } from '@/features/learner/story/storyImagePreloader'
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

let storyLibraryCache: {
  studentId: string
  library: LearnerStoryLibrary
  stale: boolean
} | null = null
let storyLibraryRequest: { studentId: string; pending: Promise<LearnerStoryLibrary> } | null = null
const storyDetailRequests = new Map<string, Promise<LearnerStoryDetail>>()

function invalidateStoryLibraryCache(studentId: string) {
  if (storyLibraryCache?.studentId === studentId) storyLibraryCache = null
}

export const getCachedStudent = (): LearnerStudent => {
  try {
    const student = useLearnerSessionStore().student
    if (student) return { ...student }
  } catch {
    // Pinia 설치 전에 평가되면 아래 빈 학생으로 폴백한다(로그인 후 실제 값으로 대체).
  }
  return {
    studentId: '',
    name: '',
    age: null,
    profileColor: '#f5c04e',
    profileImageUrl: null,
  }
}

export const fetchCurrentCurriculum = (
  studentId: string = activeStudentId(),
): Promise<LearnerCurrentCurriculum> =>
  learnerContentRepository.getCurrentCurriculum(studentId)

export const getCachedStoryLibrary = (): LearnerStoryLibrary | null => {
  const studentId = activeStudentId()
  return storyLibraryCache?.studentId === studentId ? storyLibraryCache.library : null
}

export const fetchStoryLibrary = (): Promise<LearnerStoryLibrary> => {
  const studentId = activeStudentId()
  if (storyLibraryCache?.studentId === studentId && !storyLibraryCache.stale) {
    return Promise.resolve(storyLibraryCache.library)
  }
  if (storyLibraryRequest?.studentId === studentId) return storyLibraryRequest.pending

  const pending = learnerContentRepository.getStoryLibrary(studentId)
    .then((library) => {
      storyLibraryCache = { studentId, library, stale: false }
      return library
    })
    .finally(() => {
      if (storyLibraryRequest?.studentId === studentId) storyLibraryRequest = null
    })
  storyLibraryRequest = { studentId, pending }
  return pending
}

export const markStoryLibraryCacheStale = () => {
  const studentId = activeStudentId()
  if (storyLibraryCache?.studentId === studentId) storyLibraryCache.stale = true
}

export const preloadSelectedStudentStoryLibrary = async (): Promise<void> => {
  const library = await fetchStoryLibrary()
  const nextStory = [...library.stories]
    .filter((story) => story.status === 'IN_PROGRESS')
    .sort((left, right) => Date.parse(right.lastReadAt ?? right.createdAt)
      - Date.parse(left.lastReadAt ?? left.createdAt))[0]
  if (!nextStory?.entryImageUrl) return

  const imageUrl = await resolveAuthenticatedStoryImage(
    activeStudentId(),
    nextStory.storyId,
    nextStory.entryImageUrl,
  )
  await preloadStoryImages([imageUrl])

  const detail = await getStoryDetail(nextStory.storyId)
  const firstUnreadIndex = detail.pages.findIndex((page) => page.readAt === null)
  const startIndex = firstUnreadIndex >= 0 ? firstUnreadIndex : 0
  const prioritizedPages = [
    ...detail.pages.slice(startIndex),
    ...detail.pages.slice(0, startIndex),
  ].filter((page) => page.imageUrl)

  for (let index = 0; index < prioritizedPages.length; index += 2) {
    const resolved = await Promise.all(prioritizedPages
      .slice(index, index + 2)
      .map((page) => resolveAuthenticatedStoryImage(
        activeStudentId(),
        nextStory.storyId,
        page.imageUrl,
      )))
    // 바로 읽을 두 장면은 디코딩까지 끝내고, 나머지는 영속 캐시에만 저장한다.
    if (index === 0) await preloadStoryImages(resolved)
  }
}

export const getStoryDetail = (storyId: string): Promise<LearnerStoryDetail> => {
  const studentId = activeStudentId()
  const requestKey = `${studentId}:${storyId}`
  const existing = storyDetailRequests.get(requestKey)
  if (existing) return existing

  const pending = learnerContentRepository.getStoryDetail(studentId, storyId)
    .finally(() => storyDetailRequests.delete(requestKey))
  storyDetailRequests.set(requestKey, pending)
  return pending
}

export const startStorySession = async (storyTemplateId: string): Promise<string> => {
  const studentId = activeStudentId()
  const storyId = await learnerContentRepository.startStory(studentId, storyTemplateId)
  invalidateStoryLibraryCache(studentId)
  return storyId
}

export const deleteStorySession = async (storyId: string): Promise<void> => {
  const studentId = activeStudentId()
  await learnerContentRepository.deleteStory(studentId, storyId)
  if (storyLibraryCache?.studentId === studentId) {
    storyLibraryCache = {
      studentId,
      stale: storyLibraryCache.stale,
      library: {
        ...storyLibraryCache.library,
        stories: storyLibraryCache.library.stories.filter((story) => story.storyId !== storyId),
      },
    }
  }
}

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
export const getInitialDeviceStatus = (): LearnerDeviceStatus => ({
  eyeTrackerConnected: false,
  microphoneAvailable: typeof navigator !== 'undefined' && !!navigator.mediaDevices,
  microphoneActive: false,
})

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
