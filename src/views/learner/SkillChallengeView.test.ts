// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import SkillChallengeView from './SkillChallengeView.vue'

vi.mock('@/config/learnerDataSource', () => ({ learnerDataSource: 'mock' }))

describe('SkillChallengeView 전체 시작 흐름', () => {
  it('세 영역을 안내하고 시작하기 버튼 하나로 첫 문제로 이동한다', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/challenge', name: 'skill-challenge', component: SkillChallengeView },
        {
          path: '/challenge/:trackId/:testId/:lessonId?',
          name: 'skill-challenge-lesson',
          component: { template: '<div>문제</div>' },
        },
      ],
    })
    const pinia = createPinia()
    await router.push('/challenge')
    await router.isReady()
    const wrapper = mount(
      { template: '<RouterView />' },
      { global: { plugins: [pinia, router] } },
    )

    const cards = wrapper.findAll('article.challenge-card')
    expect(cards).toHaveLength(3)
    expect(cards.map((card) => card.text())).toEqual(
      expect.arrayContaining([
        expect.stringContaining('음운 인식'),
        expect.stringContaining('짧은 글'),
        expect.stringContaining('유창성'),
      ]),
    )

    expect(wrapper.findAll('.challenge-card button')).toHaveLength(0)
    expect(wrapper.find('.challenge-action strong').exists()).toBe(false)
    expect(wrapper.find('.challenge-card__content small').exists()).toBe(false)
    expect(wrapper.find('.challenge-card__footer').exists()).toBe(false)
    expect(wrapper.text()).toContain('틀려도 괜찮아요, 편안하게 풀어봐요!')

    await wrapper.get('.challenge-action button').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('skill-challenge-lesson')
    expect(router.currentRoute.value.params.trackId).toBe('phonological')
    expect(router.currentRoute.value.params.testId).toBe('mock')
  })
})
