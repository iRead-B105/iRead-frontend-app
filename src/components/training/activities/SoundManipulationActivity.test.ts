// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { useTrainingSession } from '@/composables/useTrainingSession'
import type { TrainingQuestion } from '@/types/training'
import SoundManipulationActivity from './SoundManipulationActivity.vue'

const session = useTrainingSession()
const question: TrainingQuestion = {
  id: 'syllable-replace',
  instruction: '바꿀 소리와 새 소리를 골라봐요.',
  answer: 'unit-1:choice-jang',
  targetText: '사과',
  targetResult: '사장',
  manipulationMode: 'replace',
  manipulationUnits: [
    { id: 'unit-0', text: '사' },
    { id: 'unit-1', text: '과' },
  ],
  manipulationTargetUnitIds: ['unit-1'],
  replacementChoices: [
    { id: 'choice-jang', text: '장' },
    { id: 'choice-ja', text: '자' },
    { id: 'choice-go', text: '고' },
  ],
  replacementAnswerId: 'choice-jang',
}

describe('SoundManipulationActivity', () => {
  beforeEach(() => {
    session.setAnswerCompletedHandler(null)
    session.resetSession()
    session.startLesson({
      id: 'syllable-replace-lesson',
      categoryId: 'phonological-awareness',
      title: '음절 바꾸기',
      description: '',
      activityType: 'sound-manipulation',
      estimatedMinutes: 1,
      questions: [question],
    })
  })

  it('원래 낱말은 진한 글자 카드로 보이고, 카드를 끼우면 트레이 자리는 비워진 채 유지된다', async () => {
    const wrapper = mount(SoundManipulationActivity, { props: { question } })

    const wordUnits = wrapper.findAll('.word-unit')
    expect(wordUnits.map((unit) => unit.find('.unit-letter').text())).toEqual(['사', '과'])
    expect(wrapper.get('.complete-button').attributes('disabled')).toBeDefined()

    await wrapper.findAll('.replacement-card')[0]!.trigger('keydown.enter')
    await wordUnits[1]!.trigger('click')

    expect(wordUnits[1]!.find('.slot-card').text()).toBe('장')
    // 밀려난 글자 카드가 생기지 않고, 쓴 카드는 자리만 지킨 채 숨는다
    expect(wrapper.find('.displaced-card').exists()).toBe(false)
    expect(wrapper.findAll('.replacement-card')).toHaveLength(3)
    expect(wrapper.findAll('.replacement-card')[0]!.classes()).toContain('replacement-card--used')
    expect(wrapper.get('.complete-button').attributes('disabled')).toBeUndefined()

    // 끼운 글자 자리를 누르면 원래대로 돌아간다
    await wordUnits[1]!.trigger('click')
    expect(wordUnits[1]!.find('.unit-letter').text()).toBe('과')
    expect(wrapper.findAll('.replacement-card')[0]!.classes()).not.toContain('replacement-card--used')
    wrapper.unmount()
  })

  it('두 번째 오답 후 바꿀 글자가 반짝이고 정답 카드가 강조된다', async () => {
    session.setAnswerEvaluator(vi.fn()
      .mockResolvedValueOnce({
        attemptNo: 1,
        correct: false,
        questionCompleted: false,
        canRetry: true,
        hint: '다시 생각해 보세요.',
        correctResponse: null,
      })
      .mockResolvedValueOnce({
        attemptNo: 2,
        correct: false,
        questionCompleted: false,
        canRetry: true,
        hint: '정답을 확인해 보세요.',
        correctResponse: {
          responseType: 'SINGLE_CHOICE',
          response: { selectedIndex: 0 },
        },
      }))
    const wrapper = mount(SoundManipulationActivity, { props: { question } })

    await wrapper.findAll('.replacement-card')[1]!.trigger('keydown.enter')
    await wrapper.findAll('.word-unit')[0]!.trigger('click')
    await wrapper.get('.complete-button').trigger('click')

    // 오답이면 끼운 카드가 알아서 빠져 처음 상태로 돌아간다
    expect(wrapper.findAll('.word-unit')[0]!.find('.unit-letter').text()).toBe('사')
    expect(wrapper.find('.replacement-card--used').exists()).toBe(false)
    expect(wrapper.get('.complete-button').attributes('disabled')).toBeDefined()

    await wrapper.findAll('.replacement-card')[1]!.trigger('keydown.enter')
    await wrapper.findAll('.word-unit')[0]!.trigger('click')
    await wrapper.get('.complete-button').trigger('click')

    const answerUnit = wrapper.findAll('.word-unit')[1]!
    expect(answerUnit.classes()).toContain('word-unit--pulse')
    expect(answerUnit.classes()).toContain('word-unit--direct')
    expect(wrapper.findAll('.replacement-card')[0]!.classes()).toContain('replacement-card--hint')
    wrapper.unmount()
  })
})
