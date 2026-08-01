// @vitest-environment jsdom

import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { useLearnerSessionStore } from '@/stores/learnerSession'
import { installLearnerAuthenticationGuard } from './index'

const student = {
  studentId: '20',
  name: '새봄',
  age: 8,
  profileColor: '#FFD166',
  profileImageUrl: null,
}

function createGuardedRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'learner-login', component: { template: '<div />' } },
      {
        path: '/learner',
        component: { template: '<RouterView />' },
        meta: { requiresLearnerAuth: true },
        children: [
          { path: '', name: 'learner-home', component: { template: '<div />' } },
          { path: 'challenge', name: 'skill-challenge', component: { template: '<div />' } },
        ],
      },
    ],
  })
  installLearnerAuthenticationGuard(router)
  return router
}

describe('learner learning-entry guard', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('미완료 최초 검사가 있으면 홈 직접 진입을 실력 도전으로 되돌린다', async () => {
    const session = useLearnerSessionStore()
    session.status = 'authenticated'
    session.accessToken = 'token'
    session.student = student
    session.learningEntry = {
      studentId: '20',
      entryStatus: 'CHALLENGE_IN_PROGRESS',
      testCurriculumId: '500',
      completedQuestions: 4,
      totalQuestions: 9,
    }
    const router = createGuardedRouter()

    await router.push('/learner')
    expect(router.currentRoute.value.name).toBe('skill-challenge')
  })

  it('완료 학습자가 실력 도전으로 직접 진입하면 기존 홈으로 이동한다', async () => {
    const session = useLearnerSessionStore()
    session.status = 'authenticated'
    session.accessToken = 'token'
    session.student = student
    session.learningEntry = {
      studentId: '20',
      entryStatus: 'HOME',
      testCurriculumId: null,
      completedQuestions: 9,
      totalQuestions: 9,
    }
    const router = createGuardedRouter()

    await router.push('/learner/challenge')
    expect(router.currentRoute.value.name).toBe('learner-home')
  })
})
