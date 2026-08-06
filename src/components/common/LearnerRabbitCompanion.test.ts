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
  it('훈련 중에는 인사 상호작용이 동작하지 않고 훈련 상태를 유지한다', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const wrapper = mount(LearnerRabbitCompanion, { attachTo: host })

    const activity = document.createElement('div')
    activity.dataset.companionState = 'correct'
    document.body.append(activity)
    await vi.waitFor(() => expect(wrapper.classes()).toContain('rabbit-companion--correct'))

    // 훈련 화면에서는 마우스를 올려도 인사(손 올리기)로 바뀌지 않는다
    await wrapper.get('.rabbit-companion__character').trigger('pointerenter')
    expect(wrapper.classes()).toContain('rabbit-companion--correct')
    wrapper.unmount()
  })

  it('메인 화면에서는 마우스 인사 상호작용이 동작한다', async () => {
    route.name = 'learner-home'
    route.fullPath = '/learner/home'
    const host = document.createElement('div')
    document.body.append(host)
    const wrapper = mount(LearnerRabbitCompanion, { attachTo: host })

    await wrapper.get('.rabbit-companion__character').trigger('pointerenter')
    expect(wrapper.classes()).toContain('rabbit-companion--greeting')

    await wrapper.get('.rabbit-companion__character').trigger('pointerleave')
    expect(wrapper.classes()).toContain('rabbit-companion--idle')
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
