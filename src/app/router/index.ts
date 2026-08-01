import { createRouter, createWebHistory, type Router } from 'vue-router'
import { learnerLoginRoute, learnerRoutes } from '@/router/learnerRoutes'
import { useLearnerSessionStore } from '@/stores/learnerSession'
import { useLearnerErrorModalStore } from '@/stores/learnerErrorModal'

const activeChallengeRouteNames = new Set([
  'skill-challenge',
  'skill-challenge-lesson',
  'skill-challenge-question-complete',
])

export function installLearnerAuthenticationGuard(router: Router): void {
  router.beforeEach(async (to) => {
    const learnerSession = useLearnerSessionStore()
    const requiresLearnerAuth = to.matched.some(
      (record) => record.meta.requiresLearnerAuth === true,
    )

    if (requiresLearnerAuth) {
      const authenticated = await learnerSession.restoreSession()
      if (!authenticated) {
        return { name: 'learner-login', query: { redirect: to.fullPath } }
      }
    }

    if (learnerSession.authenticated) {
      if (to.name === 'learner-login' && learnerSession.learningEntryError) return true

      try {
        const entry = await learnerSession.resolveLearningEntry()
        const challengeRequired = entry.entryStatus !== 'HOME'
        const activeChallengeRoute = activeChallengeRouteNames.has(String(to.name ?? ''))

        if (challengeRequired && !activeChallengeRoute) {
          return { name: 'skill-challenge' }
        }
        if (!challengeRequired && activeChallengeRoute) {
          return { name: 'learner-home' }
        }
        if (to.name === 'learner-login') {
          return { name: 'learner-home' }
        }
      } catch (error) {
        useLearnerErrorModalStore().show(error, '학습 시작 상태 조회 오류')
        if (to.name === 'learner-login') return true
        return { name: 'learner-login' }
      }
    }

    return true
  })
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/learner' },
    learnerLoginRoute,
    learnerRoutes,
    { path: '/:pathMatch(.*)*', redirect: '/learner' },
  ],
})

installLearnerAuthenticationGuard(router)

export default router
