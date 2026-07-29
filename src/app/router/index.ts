import { createRouter, createWebHistory, type Router } from 'vue-router'
import { learnerLoginRoute, learnerRoutes } from '@/router/learnerRoutes'
import { useLearnerSessionStore } from '@/stores/learnerSession'

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

    if (to.name === 'learner-login' && learnerSession.authenticated) {
      return { name: 'learner-home' }
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
