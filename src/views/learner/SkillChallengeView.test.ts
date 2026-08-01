// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import SkillChallengeView from './SkillChallengeView.vue'

describe('SkillChallengeView 현재 영역 선택 흐름', () => {
  it('세 영역 카드를 표시하고 선택한 영역의 첫 문제로 이동한다', async () => {
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
    await router.push('/challenge')
    await router.isReady()
    const wrapper = mount(
      { template: '<RouterView />' },
      { global: { plugins: [router] } },
    )

    const cards = wrapper.findAll('.challenge-card')
    expect(cards).toHaveLength(3)
    expect(cards.map((card) => card.text())).toEqual(
      expect.arrayContaining([
        expect.stringContaining('음운 인식'),
        expect.stringContaining('짧은 글'),
        expect.stringContaining('유창성'),
      ]),
    )

    await cards[1]!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('skill-challenge-lesson')
    expect(router.currentRoute.value.params.trackId).toBe('short-text')
    expect(router.currentRoute.value.params.testId).toBe('mock')
  })
})
