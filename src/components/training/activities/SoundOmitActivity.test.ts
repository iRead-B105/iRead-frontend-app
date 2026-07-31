// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { useTrainingSession } from '@/composables/useTrainingSession'
import type { TrainingQuestion } from '@/types/training'
import SoundOmitActivity from './SoundOmitActivity.vue'

const session = useTrainingSession()
const question: TrainingQuestion = {
  id: 'banana-split',
  instruction: '소리를 빼봐!',
  targetText: '바나나',
  audioText: '바나',
  soundParts: ['바', '나', '나'],
  answer: '바나',
}

describe('SoundOmitActivity', () => {
  beforeEach(() => {
    session.setAnswerEvaluator(null)
    session.setAnswerCompletedHandler(null)
    session.resetSession()
    session.startLesson({
      id: 'sound-split',
      categoryId: 'phonological-awareness',
      title: '소리 나누기',
      description: '',
      activityType: 'sound-omit',
      estimatedMinutes: 1,
      questions: [question],
    })
  })

  it('퍼즐 조각을 휴지통에 끌어 놓으면 작업 영역에서 제거된다', async () => {
    const wrapper = mount(SoundOmitActivity, { props: { question } })
    vi.spyOn(
      wrapper.get('.trash-zone').element,
      'getBoundingClientRect',
    ).mockReturnValue({
      left: -10,
      right: 10,
      top: -10,
      bottom: 10,
      width: 20,
      height: 20,
      x: -10,
      y: -10,
      toJSON: () => ({}),
    })

    expect(wrapper.findAll('.puzzle-word .puzzle-piece')).toHaveLength(3)
    const piece = wrapper.findAll('.puzzle-word .puzzle-piece')[2]!
    await piece.trigger('pointerdown')
    await piece.trigger('pointermove')
    await piece.trigger('pointerup')

    expect(wrapper.findAll('.puzzle-word .puzzle-piece')).toHaveLength(2)
    expect(wrapper.find('.puzzle-result').exists()).toBe(false)
    expect(session.progressState.selectedAnswer).toBe('바나')
    wrapper.unmount()
  })

  it('되돌리기는 직전에 제거한 조각을 원래 위치로 복원한다', async () => {
    const wrapper = mount(SoundOmitActivity, { props: { question } })

    await wrapper.findAll('.puzzle-word .puzzle-piece')[1]!.trigger('keydown', { key: 'Enter' })
    expect(wrapper.findAll('.puzzle-word .puzzle-piece')).toHaveLength(2)
    await wrapper.get('.undo-button').trigger('click')

    expect(wrapper.findAll('.puzzle-word .puzzle-piece')).toHaveLength(3)
    expect(session.progressState.selectedAnswer).toBeNull()
    wrapper.unmount()
  })

  it('오답을 제출해도 현재 퍼즐을 유지하고 정답일 때만 다음 단계를 연다', async () => {
    const wrapper = mount(SoundOmitActivity, { props: { question } })

    await wrapper.findAll('.puzzle-word .puzzle-piece')[0]!.trigger('keydown', { key: 'Enter' })
    await wrapper.get('.complete-button').trigger('click')
    await flushPromises()

    expect(session.progressState.isCurrentCorrect).toBe(false)
    expect(wrapper.findAll('.puzzle-word .puzzle-piece')).toHaveLength(2)
    expect(wrapper.find('.shared-next-source').exists()).toBe(false)

    await wrapper.get('.undo-button').trigger('click')
    await wrapper.findAll('.puzzle-word .puzzle-piece')[2]!.trigger('keydown', { key: 'Enter' })
    await wrapper.get('.complete-button').trigger('click')
    await flushPromises()

    expect(session.progressState.isCurrentCorrect).toBe(true)
    expect(wrapper.get('.complete-button').classes()).toContain('complete-button--success')
    expect(wrapper.find('.shared-next-source').exists()).toBe(true)
    wrapper.unmount()
  })
})
