// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TrainingCurriculumPath, {
  type CurriculumPathStep,
} from './TrainingCurriculumPath.vue'

const makeSteps = (currentIndex: number): CurriculumPathStep[] =>
  Array.from({ length: 10 }, (_, index) => ({
    trainingId: `training-${index + 1}`,
    categoryId: 'phonics',
    status: index < currentIndex
      ? 'complete'
      : index === currentIndex
        ? 'current'
        : 'locked',
    lesson: {
      id: `lesson-${index + 1}`,
      categoryId: 'phonics',
      title: `${index + 1}번 훈련`,
      description: '페이지 배치 검증',
      activityType: 'listen-and-select',
      estimatedMinutes: 3,
      isReady: true,
    },
  }))

describe('TrainingCurriculumPath 페이지 배치', () => {
  it('네 개씩 배치하고 마지막 페이지는 남은 발판만 표시한다', async () => {
    const wrapper = mount(TrainingCurriculumPath, {
      props: { steps: makeSteps(0), studyDate: '2026-07-30' },
    })

    const expectFourFixedPositions = () => {
      const nodes = wrapper.findAll('.lesson-node')
      expect(nodes).toHaveLength(4)
      expect(nodes.map((node) => node.attributes('style'))).toEqual([
        expect.stringContaining('left: 145px'),
        expect.stringContaining('left: 410px'),
        expect.stringContaining('left: 675px'),
        expect.stringContaining('left: 940px'),
      ])
    }

    expectFourFixedPositions()
    await wrapper.find('.path-nav--right').trigger('click')
    expectFourFixedPositions()
    expect(wrapper.findAll('.lesson-node').map((node) => node.attributes('aria-label'))).toEqual([
      expect.stringContaining('5번'),
      expect.stringContaining('6번'),
      expect.stringContaining('7번'),
      expect.stringContaining('8번'),
    ])

    await wrapper.find('.path-nav--right').trigger('click')
    const lastPageNodes = wrapper.findAll('.lesson-node')
    expect(lastPageNodes).toHaveLength(2)
    expect(lastPageNodes.map((node) => node.attributes('aria-label'))).toEqual([
      expect.stringContaining('9번'),
      expect.stringContaining('10번'),
    ])
    expect(lastPageNodes.map((node) => node.attributes('style'))).toEqual([
      expect.stringContaining('left: 145px'),
      expect.stringContaining('left: 410px'),
    ])
  })

  it('처음 열 때 현재 토끼가 있는 페이지로 이동한다', () => {
    const wrapper = mount(TrainingCurriculumPath, {
      props: { steps: makeSteps(5), studyDate: '2026-07-30' },
    })

    expect(wrapper.findAll('.lesson-node').map((node) => node.attributes('aria-label'))).toEqual([
      expect.stringContaining('5번'),
      expect.stringContaining('6번'),
      expect.stringContaining('7번'),
      expect.stringContaining('8번'),
    ])
    expect(wrapper.find('.lesson-node--current .path-rabbit').exists()).toBe(true)
    expect(wrapper.find('.path-nav--left').attributes()).not.toHaveProperty('disabled')
    expect(wrapper.find('.path-nav--right').attributes()).not.toHaveProperty('disabled')
  })
})
