import type { Pinia } from 'pinia'
import { watch, type WatchStopHandle } from 'vue'
import type { Router } from 'vue-router'
import { useDailyCurriculum } from '@/composables/useDailyCurriculum'
import { RealtimeClient, type RealtimeEvent } from '@/lib/realtime/realtimeClient'
import { useLearnerSessionStore } from '@/stores/learnerSession'
import { fetchLearnerStudentProfile } from '@/features/learner/student/apiLearnerStudentRepository'

const SAFETY_REFRESH_MILLIS = 3_000
const CURRICULUM_ROUTES = new Set([
  'learner-home',
  'training-home',
  'training-category',
])

export function installLearnerRealtimeSync(
  pinia: Pinia,
  router: Router,
): () => void {
  const session = useLearnerSessionStore(pinia)
  const dailyCurriculum = useDailyCurriculum()
  let client: RealtimeClient | null = null
  let refreshPromise: Promise<void> | null = null
  let profileRefreshPromise: Promise<void> | null = null
  let deletedStudentSessionPromise: Promise<void> | null = null
  let lastVersion = 0

  const invalidateDeletedStudentSession = (): Promise<void> => {
    if (deletedStudentSessionPromise) return deletedStudentSessionPromise
    const task = session.invalidateDeletedStudentSession()
      .then(async () => {
        if (router.currentRoute.value.name !== 'learner-login') {
          await router.replace({ name: 'learner-login' })
        }
      })
      .finally(() => {
        if (deletedStudentSessionPromise === task) deletedStudentSessionPromise = null
      })
    deletedStudentSessionPromise = task
    return task
  }

  const refreshCurriculum = (): Promise<void> => {
    if (
      !session.authenticated
      || document.visibilityState !== 'visible'
      || !CURRICULUM_ROUTES.has(String(router.currentRoute.value.name))
    ) {
      return Promise.resolve()
    }
    if (refreshPromise) return refreshPromise
    const task = dailyCurriculum.reloadCurrentCurriculum()
      .catch(() => undefined)
      .finally(() => {
        if (refreshPromise === task) refreshPromise = null
      })
    refreshPromise = task
    return task
  }

  const refreshProfile = (): Promise<void> => {
    const studentId = session.student?.studentId
    if (!session.authenticated || !studentId || document.visibilityState !== 'visible') {
      return Promise.resolve()
    }
    if (profileRefreshPromise) return profileRefreshPromise
    const task = fetchLearnerStudentProfile(studentId)
      .then((profile) => session.replaceStudentProfile(profile))
      .catch(() => undefined)
      .finally(() => {
        if (profileRefreshPromise === task) profileRefreshPromise = null
      })
    profileRefreshPromise = task
    return task
  }

  const handleEvent = async (event: RealtimeEvent): Promise<void> => {
    if (
      String(event.studentId) !== session.student?.studentId
      || event.version <= lastVersion
    ) {
      return
    }
    lastVersion = event.version
    if (event.resource === 'STUDENT' && event.changeType === 'DELETED') {
      await invalidateDeletedStudentSession()
      return
    }
    if (event.resource === 'CURRICULUM' || event.resource === 'TRAINING') {
      await refreshCurriculum()
    } else if (event.resource === 'STUDENT') {
      await refreshProfile()
    }
  }

  const stopWatch: WatchStopHandle = watch(
    () => (session.authenticated ? session.accessToken : null),
    (accessToken) => {
      client?.stop()
      client = null
      lastVersion = 0
      if (!accessToken) {
        dailyCurriculum.clearDailyCurriculum()
        return
      }
      client = new RealtimeClient({
        endpoint: '/api/app/realtime/events',
        onEvent: handleEvent,
        onStateChange: (state) => {
          if (state === 'connected') {
            void refreshCurriculum()
            void refreshProfile()
          }
        },
      })
      client.start()
    },
    { immediate: true },
  )

  const safetyInterval = window.setInterval(() => {
    if (CURRICULUM_ROUTES.has(String(router.currentRoute.value.name))) {
      void refreshCurriculum()
      void refreshProfile()
    }
  }, SAFETY_REFRESH_MILLIS)

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      void refreshCurriculum()
      void refreshProfile()
    }
  }
  document.addEventListener('visibilitychange', handleVisibility)

  return () => {
    stopWatch()
    client?.stop()
    window.clearInterval(safetyInterval)
    document.removeEventListener('visibilitychange', handleVisibility)
  }
}
