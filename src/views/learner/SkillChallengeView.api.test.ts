// @vitest-environment jsdom

import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/learnerDataSource', () => ({ learnerDataSource: 'api' }))

const { getChallengePlan } = vi.hoisted(() => ({
  getChallengePlan: vi.fn(),
}))
vi.mock('@/features/learner/test', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/features/learner/test')>()
  return {
    ...original,
    learnerTestRepository: {
      source: 'api',
      getChallengePlan,
    },
  }
})

import SkillChallengeView from './SkillChallengeView.vue'

describe('SkillChallengeView API 연속 진행', () => {
  beforeEach(() => {
    getChallengePlan.mockReset()
    getChallengePlan.mockResolvedValue({
      testCurriculumId: '500',
      completedQuestions: 3,
      totalQuestions: 9,
      completed: false,
      nextTestId: '104',
      nextTrackCode: 'short-text',
      tracks: [],
    })
  })

  it('서버의 전체 nextTestId와 nextTrackCode로 네 번째 문제를 이어간다', async () => {
    const pinia = createPinia()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/challenge', name: 'skill-challenge', component: SkillChallengeView },
        {
          path: '/challenge/:trackId/:testId/:lessonId?',
          name: 'skill-challenge-lesson',
          component: { template: '<div>문제</div>' },
        },
        { path: '/home', name: 'learner-home', component: { template: '<div>홈</div>' } },
      ],
    })
    await router.push('/challenge')
    await router.isReady()
    const wrapper = mount(
      { template: '<RouterView />' },
      { global: { plugins: [pinia, router] } },
    )
    await flushPromises()

    expect(wrapper.get('.challenge-action strong').text()).toContain('3 / 9문제')
    expect(wrapper.get('.challenge-action button').text()).toBe('이어하기')

    await wrapper.get('.challenge-action button').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.params).toMatchObject({
      trackId: 'short-text',
      testId: '104',
    })
  })
})
