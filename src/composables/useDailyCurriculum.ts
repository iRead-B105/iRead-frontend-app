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

const loadCurrentCurriculum = () => {
  const studentId = getCachedStudent().studentId
  ensureStudentState(studentId)
  if (loadPromise && loadingStudentId === studentId) return loadPromise
  if (loadedStudentId === studentId && !curriculumError.value) return Promise.resolve()

  resetCurriculumState()
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
                lesson,
                status: training.status,
              }]
            : []
        }),
      )
      loadedStudentId = studentId
    })
    .catch((error: unknown) => {
      if (requestVersion !== stateVersion || getCachedStudent().studentId !== studentId) return
      if (isExpectedUnavailable(error)) {
        resetCurriculumState('unavailable')
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
  await loadCurrentCurriculum()
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
