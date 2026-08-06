// @vitest-environment jsdom

import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RealtimeEvent } from '@/lib/realtime/realtimeClient'
import { useLearnerSessionStore } from '@/stores/learnerSession'
import { installLearnerRealtimeSync } from './installLearnerRealtimeSync'

interface CapturedRealtimeOptions {
  readonly onEvent: (event: RealtimeEvent) => void | Promise<void>
}

const realtimeHarness = vi.hoisted(() => ({
  options: null as unknown,
  stop: vi.fn(),
}))

const imageCacheHarness = vi.hoisted(() => ({
  clearProfileImages: vi.fn().mockResolvedValue(undefined),
  clearStoryImages: vi.fn().mockResolvedValue(undefined),
}))

const profileHarness = vi.hoisted(() => ({
  fetchProfile: vi.fn(),
}))

vi.mock('@/lib/realtime/realtimeClient', () => ({
  RealtimeClient: class {
    constructor(options: unknown) {
      realtimeHarness.options = options
    }

    start() {}

    stop() {
      realtimeHarness.stop()
    }
  },
}))

vi.mock('@/features/learner/auth/authenticatedProfileImage', async (importOriginal) => ({
  ...(await importOriginal()),
  clearAuthenticatedProfileImages: imageCacheHarness.clearProfileImages,
}))

vi.mock('@/features/learner/story/authenticatedStoryImage', async (importOriginal) => ({
  ...(await importOriginal()),
  clearAuthenticatedStoryImages: imageCacheHarness.clearStoryImages,
}))

vi.mock('@/features/learner/student/apiLearnerStudentRepository', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchLearnerStudentProfile: profileHarness.fetchProfile,
}))

async function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/login',
        name: 'learner-login',
        component: { template: '<div />' },
      },
      {
        path: '/story/:storyId',
        name: 'story-reader',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/story/180163')
  await router.isReady()

  const session = useLearnerSessionStore(pinia)
  session.status = 'authenticated'
  session.accessToken = 'student-access-token'
  session.student = {
    studentId: '2001',
    name: '엘리스',
    age: 8,
    profileColor: '#f18ca4',
    profileImageUrl: null,
  }
  return { pinia, router, session }
}

describe('installLearnerRealtimeSync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    realtimeHarness.options = null
    realtimeHarness.stop.mockClear()
    imageCacheHarness.clearProfileImages.mockClear()
    imageCacheHarness.clearStoryImages.mockClear()
    profileHarness.fetchProfile.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('현재 아동 삭제 이벤트를 받으면 세션과 이미지 캐시를 비우고 로그인으로 이동한다', async () => {
    const { pinia, router, session } = await setup()
    const stop = installLearnerRealtimeSync(pinia, router)
    const options = realtimeHarness.options as CapturedRealtimeOptions

    await options.onEvent({
      eventId: 'student-deleted-2001',
      studentId: 2001,
      resource: 'STUDENT',
      resourceId: 2001,
      changeType: 'DELETED',
      occurredAt: '2026-08-06T15:00:00+09:00',
      version: 1,
    })
    await flushPromises()

    expect(session.status).toBe('anonymous')
    expect(session.accessToken).toBeNull()
    expect(session.student).toBeNull()
    expect(imageCacheHarness.clearProfileImages).toHaveBeenCalledOnce()
    expect(imageCacheHarness.clearStoryImages).toHaveBeenCalledOnce()
    expect(profileHarness.fetchProfile).not.toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('learner-login')
    expect(realtimeHarness.stop).toHaveBeenCalled()
    stop()
  })

  it('다른 아동의 삭제 이벤트는 현재 세션에 영향을 주지 않는다', async () => {
    const { pinia, router, session } = await setup()
    const stop = installLearnerRealtimeSync(pinia, router)
    const options = realtimeHarness.options as CapturedRealtimeOptions

    await options.onEvent({
      eventId: 'student-deleted-2002',
      studentId: 2002,
      resource: 'STUDENT',
      resourceId: 2002,
      changeType: 'DELETED',
      occurredAt: '2026-08-06T15:00:00+09:00',
      version: 1,
    })

    expect(session.authenticated).toBe(true)
    expect(session.student?.studentId).toBe('2001')
    expect(router.currentRoute.value.name).toBe('story-reader')
    stop()
  })
})
