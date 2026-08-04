// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import LearnerRabbitCompanion from './LearnerRabbitCompanion.vue'

const route = reactive({ name: 'training-lesson', fullPath: '/learner/training/demo' })

vi.mock('vue-router', () => ({ useRoute: () => route }))

afterEach(() => {
  document.body.innerHTML = ''
  route.name = 'training-lesson'
  route.fullPath = '/learner/training/demo'
})

describe('LearnerRabbitCompanion', () => {
  it('훈련 결과 상태와 인사 상호작용에 맞는 토끼를 보여준다', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const wrapper = mount(LearnerRabbitCompanion, { attachTo: host })

    const activity = document.createElement('div')
    activity.dataset.companionState = 'correct'
    document.body.append(activity)
    await vi.waitFor(() => expect(wrapper.classes()).toContain('rabbit-companion--correct'))

    await wrapper.get('.rabbit-companion__character').trigger('pointerenter')
    expect(wrapper.classes()).toContain('rabbit-companion--greeting')

    await wrapper.get('.rabbit-companion__character').trigger('pointerleave')
    expect(wrapper.classes()).toContain('rabbit-companion--correct')
    wrapper.unmount()
  })

  it('이야기 화면에서는 이야기 상태를 사용한다', async () => {
    route.name = 'story-reading'
    route.fullPath = '/learner/stories/1'
    const wrapper = mount(LearnerRabbitCompanion)
    await vi.waitFor(() => expect(wrapper.classes()).toContain('rabbit-companion--story'))
    wrapper.unmount()
  })
})
