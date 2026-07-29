import { computed, ref } from 'vue'
import { getCategoryById, isPlayableLesson } from '@/mocks/trainingLookup'
import type { TrainingCategoryId } from '@/types/training'

export type SkillChallengeTrackId = 'phonological' | 'short-text' | 'fluency'

export interface SkillChallengeLesson {
  categoryId: TrainingCategoryId
  lessonId: string
  title: string
}

export interface SkillChallengeTrack {
  id: SkillChallengeTrackId
  title: string
  shortLabel: string
  description: string
  symbol: string
  categoryIds: TrainingCategoryId[]
  color: 'orange' | 'blue' | 'purple'
}

export const skillChallengeTracks: SkillChallengeTrack[] = [
  {
    id: 'phonological',
    title: '음운 인식',
    shortLabel: '소리와 글자',
    description: '소리를 듣고, 찾고, 글자로 만드는 훈련을 차례로 해봐요.',
    symbol: '가',
    categoryIds: ['phonological-awareness', 'phonics'],
    color: 'orange',
  },
  {
    id: 'short-text',
    title: '짧은 글',
    shortLabel: '문장 이해',
    description: '낱말과 짧은 문장을 읽고 뜻을 찾는 훈련을 차례로 해봐요.',
    symbol: '문',
    categoryIds: ['short-text'],
    color: 'blue',
  },
  {
    id: 'fluency',
    title: '유창성',
    shortLabel: '자연스럽게 읽기',
    description: '낱말과 문장을 또박또박 읽는 훈련을 차례로 해봐요.',
    symbol: '술',
    categoryIds: ['fluency'],
    color: 'purple',
  },
]

const activeTrackId = ref<SkillChallengeTrackId | null>(null)
const orderedLessons = ref<SkillChallengeLesson[]>([])
const currentIndex = ref(0)
const completedLessonIds = ref<string[]>([])

export const isSkillChallengeTrackId = (value: string): value is SkillChallengeTrackId =>
  skillChallengeTracks.some((track) => track.id === value)

export const getSkillChallengeTrack = (trackId: string): SkillChallengeTrack | null =>
  skillChallengeTracks.find((track) => track.id === trackId) ?? null

export const getSkillChallengeLessons = (
  trackId: SkillChallengeTrackId,
): SkillChallengeLesson[] => {
  const track = getSkillChallengeTrack(trackId)
  if (!track) return []

  return track.categoryIds.flatMap((categoryId) => {
    const category = getCategoryById(categoryId)
    if (!category) return []

    return category.lessons
      .filter((lesson) => isPlayableLesson(categoryId, lesson.id))
      .map((lesson) => ({
        categoryId,
        lessonId: lesson.id,
        title: lesson.title,
      }))
  })
}

const resetTrack = (trackId: SkillChallengeTrackId) => {
  activeTrackId.value = trackId
  orderedLessons.value = getSkillChallengeLessons(trackId)
  currentIndex.value = 0
  completedLessonIds.value = []
}

export function useSkillChallenge() {
  const activeTrack = computed(() =>
    activeTrackId.value ? getSkillChallengeTrack(activeTrackId.value) : null,
  )
  const currentLesson = computed(() => orderedLessons.value[currentIndex.value] ?? null)
  const totalLessons = computed(() => orderedLessons.value.length)
  const completedCount = computed(() => completedLessonIds.value.length)
  const progressPercent = computed(() =>
    totalLessons.value === 0 ? 0 : (completedCount.value / totalLessons.value) * 100,
  )

  const startChallenge = (trackId: SkillChallengeTrackId): SkillChallengeLesson | null => {
    resetTrack(trackId)
    return currentLesson.value
  }

  const ensureChallenge = (
    trackId: SkillChallengeTrackId,
    lessonId?: string,
  ): SkillChallengeLesson | null => {
    if (activeTrackId.value !== trackId || orderedLessons.value.length === 0) {
      resetTrack(trackId)
    }

    if (lessonId) {
      const lessonIndex = orderedLessons.value.findIndex((lesson) => lesson.lessonId === lessonId)
      if (lessonIndex >= 0) currentIndex.value = lessonIndex
    }

    return currentLesson.value
  }

  const markLessonComplete = (lessonId: string): SkillChallengeLesson | null => {
    if (!completedLessonIds.value.includes(lessonId)) {
      completedLessonIds.value = [...completedLessonIds.value, lessonId]
    }

    const lessonIndex = orderedLessons.value.findIndex((lesson) => lesson.lessonId === lessonId)
    if (lessonIndex >= 0) currentIndex.value = lessonIndex

    if (currentIndex.value >= orderedLessons.value.length - 1) return null
    currentIndex.value += 1
    return currentLesson.value
  }

  return {
    activeTrackId,
    activeTrack,
    orderedLessons,
    currentIndex,
    currentLesson,
    totalLessons,
    completedLessonIds,
    completedCount,
    progressPercent,
    startChallenge,
    ensureChallenge,
    markLessonComplete,
  }
}
