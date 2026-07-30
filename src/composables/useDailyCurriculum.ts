import { computed, reactive, ref } from 'vue'
import { findLessonSummary } from '@/mocks/trainingLookup'
import { fetchCurrentCurriculum, getCachedStudent } from '@/services/learnerDataRepository'
import type { TrainingLessonSummary } from '@/types/training'

export interface DailyCurriculumItem {
  trainingId: string
  categoryId: string
  lesson: TrainingLessonSummary
}

export type CurriculumRoundStatus = 'preparing' | 'ready' | 'rest' | 'completed'

const curriculumItems = reactive<DailyCurriculumItem[]>([])
const currentIndex = ref(0)
const curriculumStatus = ref<CurriculumRoundStatus>('preparing')
const curriculumId = ref('')
const studyDate = ref<string | null>(null)
const curriculumError = ref<string | null>(null)
let loadPromise: Promise<void> | null = null
let loadingStudentId: string | null = null
let loadedStudentId: string | null = null

const loadCurrentCurriculum = () => {
  const studentId = getCachedStudent().studentId
  if (loadPromise && loadingStudentId === studentId) return loadPromise
  if (loadedStudentId === studentId && !curriculumError.value) return Promise.resolve()

  curriculumItems.splice(0, curriculumItems.length)
  curriculumId.value = ''
  studyDate.value = null
  currentIndex.value = 0
  curriculumStatus.value = 'preparing'
  curriculumError.value = null
  loadingStudentId = studentId

  const task = fetchCurrentCurriculum(studentId)
    .then((response) => {
      if (getCachedStudent().studentId !== studentId) return
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
            ? [{ trainingId: training.trainingId, categoryId: training.categoryId, lesson }]
            : []
        }),
      )
      loadedStudentId = studentId
    })
    .catch((error: unknown) => {
      if (getCachedStudent().studentId !== studentId) return
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
  if (loadPromise && loadingStudentId === studentId) await loadPromise
  loadedStudentId = null
  await loadCurrentCurriculum()
  if (curriculumError.value) {
    throw new Error(curriculumError.value)
  }
}

export function useDailyCurriculum() {
  void loadCurrentCurriculum()

  const isTodayComplete = computed(() => (
    curriculumStatus.value === 'completed'
    || (curriculumStatus.value === 'ready' && currentIndex.value >= curriculumItems.length)
  ))

  const markLessonComplete = (lessonId: string) => {
    const lessonIndex = curriculumItems.findIndex((item) => item.lesson.id === lessonId)
    if (lessonIndex === currentIndex.value) {
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
    loadCurrentCurriculum,
    reloadCurrentCurriculum,
  }
}
