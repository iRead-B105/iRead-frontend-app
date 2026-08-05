import { computed, reactive, ref } from 'vue'
import { isApiError } from '@/lib/api'
import { findLessonSummary } from '@/mocks/trainingLookup'
import { fetchCurrentCurriculum, getCachedStudent } from '@/services/learnerDataRepository'
import type { LearnerTrainingStatus } from '@/features/learner/model'
import type { TrainingLessonSummary } from '@/types/training'

export interface DailyCurriculumItem {
  trainingId: string
  categoryId: string
  lesson: TrainingLessonSummary
  status: LearnerTrainingStatus
}

export type CurriculumRoundStatus =
  | 'preparing'
  | 'unavailable'
  | 'ready'
  | 'rest'
  | 'completed'

const curriculumItems = reactive<DailyCurriculumItem[]>([])
const currentIndex = ref(0)
const curriculumStatus = ref<CurriculumRoundStatus>('preparing')
const curriculumId = ref('')
const studyDate = ref<string | null>(null)
const curriculumError = ref<string | null>(null)
let loadPromise: Promise<void> | null = null
let loadingStudentId: string | null = null
let loadedStudentId: string | null = null
let stateVersion = 0

const resetCurriculumState = (status: CurriculumRoundStatus = 'preparing') => {
  curriculumItems.splice(0, curriculumItems.length)
  curriculumId.value = ''
  studyDate.value = null
  currentIndex.value = 0
  curriculumStatus.value = status
  curriculumError.value = null
}

const clearDailyCurriculum = () => {
  stateVersion += 1
  loadPromise = null
  loadingStudentId = null
  loadedStudentId = null
  resetCurriculumState()
}

const ensureStudentState = (studentId: string) => {
  if (
    (loadedStudentId !== null && loadedStudentId !== studentId)
    || (loadingStudentId !== null && loadingStudentId !== studentId)
  ) {
    clearDailyCurriculum()
  }
}

const isExpectedUnavailable = (error: unknown): boolean => (
  isApiError(error)
  && error.status === 404
  && (
    error.code === 'ACTIVE_CURRICULUM_NOT_FOUND'
    || error.message.includes('현재 진행 가능한 커리큘럼')
  )
)

const loadCurrentCurriculum = (preserveCurrentState = false) => {
  const studentId = getCachedStudent().studentId
  ensureStudentState(studentId)
  if (loadPromise && loadingStudentId === studentId) return loadPromise
  if (loadedStudentId === studentId && !curriculumError.value) return Promise.resolve()

  if (preserveCurrentState) {
    curriculumError.value = null
  } else {
    resetCurriculumState()
  }
  loadingStudentId = studentId
  const requestVersion = stateVersion

  const task = fetchCurrentCurriculum(studentId)
    .then((response) => {
      if (requestVersion !== stateVersion || getCachedStudent().studentId !== studentId) return
      curriculumError.value = null
      curriculumId.value = response.curriculumId
      studyDate.value = response.studyDate
      curriculumStatus.value = response.status.toLowerCase() as CurriculumRoundStatus
      currentIndex.value = Math.max(response.currentOrder - 1, 0)

      curriculumItems.splice(
        0,
        curriculumItems.length,
        ...response.trainings.flatMap((training) => {
          const lesson = findLessonSummary(training.categoryId, training.lessonId)
          return lesson
            ? [{
                trainingId: training.trainingId,
                categoryId: training.categoryId,
                // 서버 훈련명을 우선 표시해 백엔드·교수자 웹과 표기를 일치시킨다
                lesson: training.name ? { ...lesson, title: training.name } : lesson,
                status: training.status,
              }]
            : []
        }),
      )
      loadedStudentId = studentId
    })
    .catch((error: unknown) => {
      if (requestVersion !== stateVersion || getCachedStudent().studentId !== studentId) return
      // "진행 가능한 커리큘럼 없음"(404)은 확정 응답이므로 이전 상태 유지보다 우선한다.
      // 마지막 훈련 완료 직후 다음 커리큘럼이 아직 생성 전이면 이 응답이 오는데,
      // 이때 완료된 커리큘럼 상태를 유지하면 방금 끝낸 훈련을 다음 훈련으로 착각해
      // 같은 라우트로의 이동(no-op)이 되면서 저장 오버레이가 무한 로딩으로 남는다.
      if (isExpectedUnavailable(error)) {
        resetCurriculumState('unavailable')
        loadedStudentId = studentId
        return
      }
      if (preserveCurrentState && curriculumItems.length > 0) {
        loadedStudentId = studentId
        return
      }
      curriculumStatus.value = 'preparing'
      curriculumError.value =
        error instanceof Error ? error.message : '오늘 학습 정보를 불러오지 못했어요.'
      loadedStudentId = null
    })
    .finally(() => {
      if (loadPromise === task) {
        loadPromise = null
        loadingStudentId = null
      }
    })

  loadPromise = task
  return task
}

const reloadCurrentCurriculum = async () => {
  const studentId = getCachedStudent().studentId
  if (loadPromise && loadingStudentId === studentId) {
    await loadPromise
    if (curriculumError.value) throw new Error(curriculumError.value)
    return
  }
  loadedStudentId = null
  await loadCurrentCurriculum(true)
  if (curriculumError.value) {
    throw new Error(curriculumError.value)
  }
}

export function useDailyCurriculum() {
  ensureStudentState(getCachedStudent().studentId)

  const isTodayComplete = computed(() => (
    curriculumStatus.value === 'completed'
    || (curriculumStatus.value === 'ready' && currentIndex.value >= curriculumItems.length)
  ))

  const markLessonComplete = (lessonId: string) => {
    const lessonIndex = curriculumItems.findIndex((item) => item.lesson.id === lessonId)
    if (lessonIndex === currentIndex.value) {
      const completed = curriculumItems[lessonIndex]
      const next = curriculumItems[lessonIndex + 1]
      if (completed) completed.status = 'COMPLETED'
      if (next) next.status = 'CURRENT'
      currentIndex.value += 1
      if (currentIndex.value >= curriculumItems.length) curriculumStatus.value = 'completed'
    }
    return lessonIndex >= 0 ? curriculumItems[lessonIndex + 1] ?? null : null
  }

  return {
    curriculumItems,
    curriculumId,
    studyDate,
    curriculumError,
    curriculumStatus,
    currentIndex,
    isTodayComplete,
    markLessonComplete,
    clearDailyCurriculum,
    loadCurrentCurriculum,
    reloadCurrentCurriculum,
  }
}
