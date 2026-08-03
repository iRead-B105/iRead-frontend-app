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
      title: `lesson ${index + 1}`,
      description: 'pagination test lesson',
      activityType: 'listen-and-select',
      estimatedMinutes: 3,
      isReady: true,
    },
  }))

const visibleTitles = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('.lesson-node strong').map((node) => node.text())

describe('TrainingCurriculumPath pagination', () => {
  it('renders four steps per page and only the remainder on the last page', async () => {
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
    expect(visibleTitles(wrapper)).toEqual(['lesson 5', 'lesson 6', 'lesson 7', 'lesson 8'])

    await wrapper.find('.path-nav--right').trigger('click')
    const lastPageNodes = wrapper.findAll('.lesson-node')
    expect(lastPageNodes).toHaveLength(2)
    expect(visibleTitles(wrapper)).toEqual(['lesson 9', 'lesson 10'])
    expect(lastPageNodes.map((node) => node.attributes('style'))).toEqual([
      expect.stringContaining('left: 145px'),
      expect.stringContaining('left: 410px'),
    ])
  })

  it('opens on the page containing the current lesson', () => {
    const wrapper = mount(TrainingCurriculumPath, {
      props: { steps: makeSteps(5), studyDate: '2026-07-30' },
    })

    expect(visibleTitles(wrapper)).toEqual(['lesson 5', 'lesson 6', 'lesson 7', 'lesson 8'])
    expect(wrapper.find('.lesson-node--current .path-rabbit').exists()).toBe(true)
    expect(wrapper.find('.path-nav--left').attributes()).not.toHaveProperty('disabled')
    expect(wrapper.find('.path-nav--right').attributes()).not.toHaveProperty('disabled')
  })

  it('keeps the page selected by the user when background data retains the same current lesson', async () => {
    const wrapper = mount(TrainingCurriculumPath, {
      props: { steps: makeSteps(5), studyDate: '2026-07-30' },
    })

    await wrapper.find('.path-nav--left').trigger('click')
    expect(visibleTitles(wrapper)).toEqual(['lesson 1', 'lesson 2', 'lesson 3', 'lesson 4'])

    await wrapper.setProps({ steps: makeSteps(5) })

    expect(visibleTitles(wrapper)).toEqual(['lesson 1', 'lesson 2', 'lesson 3', 'lesson 4'])
  })
})
