import type { RouteRecordRaw } from 'vue-router'
import { useTrainingSession } from '@/composables/useTrainingSession'
import {
  getSkillChallengeLessons,
  isSkillChallengeTrackId,
} from '@/composables/useSkillChallenge'
import { isPlayableLesson, isValidCategoryId } from '@/mocks/trainingLookup'
import { learnerDataSource } from '@/config/learnerDataSource'

const redirectTrainingHome = '/learner/training'

const validateCategory: RouteRecordRaw['beforeEnter'] = (to) => {
  const categoryId = String(to.params.categoryId ?? '')
  return isValidCategoryId(categoryId) ? true : redirectTrainingHome
}

const validateLesson: RouteRecordRaw['beforeEnter'] = (to) => {
  const categoryId = String(to.params.categoryId ?? '')
  const lessonId = String(to.params.lessonId ?? '')
  const hasServerTrainingId =
    typeof to.query.trainingId === 'string' && /^\d+$/.test(to.query.trainingId)
  return isValidCategoryId(categoryId) &&
    isPlayableLesson(categoryId, lessonId) &&
    (learnerDataSource === 'mock' || hasServerTrainingId)
    ? true
    : redirectTrainingHome
}

const validateComplete: RouteRecordRaw['beforeEnter'] = (to) => {
  const categoryId = String(to.params.categoryId ?? '')
  const lessonId = String(to.params.lessonId ?? '')

  if (!isValidCategoryId(categoryId) || !isPlayableLesson(categoryId, lessonId)) {
    return redirectTrainingHome
  }

  const { progressState } = useTrainingSession()
  const completed =
    progressState.isCompleted &&
    progressState.lessonId === lessonId &&
    progressState.categoryId === categoryId

  return completed ? true : { name: 'training-lesson', params: { categoryId, lessonId } }
}

const validateChallengeLesson: RouteRecordRaw['beforeEnter'] = (to) => {
  const trackId = String(to.params.trackId ?? '')
  const testId = String(to.params.testId ?? '')
  const lessonId = String(to.params.lessonId ?? '')
  const lessons = isSkillChallengeTrackId(trackId)
    ? getSkillChallengeLessons(trackId)
    : []
  const validTestId = learnerDataSource === 'mock'
    ? testId === 'mock'
    : /^\d+$/.test(testId)
  return isSkillChallengeTrackId(trackId) &&
    validTestId &&
    lessons.length > 0 &&
    (!lessonId || lessons.some((lesson) => lesson.lessonId === lessonId))
    ? true
    : { name: 'skill-challenge' }
}

const validateChallengeQuestionComplete: RouteRecordRaw['beforeEnter'] = (to) => {
  const trackId = String(to.params.trackId ?? '')
  const testId = String(to.params.testId ?? '')
  const validTestId = learnerDataSource === 'mock'
    ? testId === 'mock'
    : /^\d+$/.test(testId)
  if (!isSkillChallengeTrackId(trackId) || !validTestId) {
    return { name: 'skill-challenge' }
  }

  const requestedLessonId = String(to.query.lessonId ?? '')
  const lessons = getSkillChallengeLessons(trackId)
  const presentation =
    lessons.find((lesson) => lesson.lessonId === requestedLessonId) ?? lessons[0]
  const { progressState } = useTrainingSession()
  const completed =
    presentation &&
    progressState.isCompleted &&
    progressState.lessonId === presentation.lessonId &&
    progressState.categoryId === presentation.categoryId

  return completed
    ? true
    : { name: 'skill-challenge-lesson', params: { trackId, testId } }
}

export const learnerLoginRoute: RouteRecordRaw = {
  path: '/learner/login',
  name: 'learner-login',
  component: () => import('@/views/learner/LearnerLoginView.vue'),
  meta: { title: '아동 학습 로그인', learnerPublic: true },
}

export const learnerRoutes: RouteRecordRaw = {
  path: '/learner',
  component: () => import('@/layouts/LearnerLayout.vue'),
  meta: { requiresLearnerAuth: true },
  children: [
    { path: '', name: 'learner-home', component: () => import('@/views/learner/LearnerHomeView.vue') },
    { path: 'stories', name: 'story-selection', component: () => import('@/views/learner/StorySelectionView.vue') },
    { path: 'stories/:storyId', name: 'story-reading', component: () => import('@/views/learner/StoryReaderView.vue') },
    { path: 'training', name: 'training-home', component: () => import('@/views/learner/TrainingHomeView.vue') },
    {
      path: 'training/:categoryId',
      name: 'training-category',
      component: () => import('@/views/learner/TrainingHomeView.vue'),
      beforeEnter: validateCategory,
    },
    {
      path: 'training/:categoryId/:lessonId',
      name: 'training-lesson',
      component: () => import('@/views/learner/TrainingLessonView.vue'),
      beforeEnter: validateLesson,
    },
    {
      path: 'training/:categoryId/:lessonId/complete',
      name: 'training-complete',
      component: () => import('@/views/learner/TrainingCompleteView.vue'),
      beforeEnter: validateComplete,
      meta: { hideLearnerHeader: true },
    },
    {
      path: 'training/today/complete',
      name: 'training-today-complete',
      component: () => import('@/views/learner/TodayTrainingCompleteView.vue'),
      meta: { hideLearnerHeader: true },
    },
    { path: 'growth', name: 'growth', component: () => import('@/views/learner/GrowthView.vue') },
    { path: 'challenge', name: 'skill-challenge', component: () => import('@/views/learner/SkillChallengeView.vue') },
    {
      path: 'challenge/:trackId/:testId/:lessonId?',
      name: 'skill-challenge-lesson',
      component: () => import('@/views/learner/TrainingLessonView.vue'),
      beforeEnter: validateChallengeLesson,
    },
    {
      path: 'challenge/:trackId/:testId/complete',
      name: 'skill-challenge-question-complete',
      component: () => import('@/views/learner/TrainingCompleteView.vue'),
      beforeEnter: validateChallengeQuestionComplete,
      meta: { hideLearnerHeader: true },
    },
    {
      path: 'challenge/complete',
      name: 'skill-challenge-complete',
      component: () => import('@/views/learner/SkillChallengeCompleteView.vue'),
      meta: { hideLearnerHeader: true },
    },
  ],
}
