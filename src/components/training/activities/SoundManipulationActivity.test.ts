// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { useTrainingSession } from '@/composables/useTrainingSession'
import type { TrainingQuestion } from '@/types/training'
import SoundManipulationActivity from './SoundManipulationActivity.vue'

const session = useTrainingSession()
const question: TrainingQuestion = {
  id: 'final-delete',
  instruction: '빼야 할 소리를 골라요',
  answer: 'unit-2',
  targetText: '감',
  targetResult: '가',
  manipulationMode: 'remove',
  manipulationUnits: [
    { id: 'unit-0', text: 'ㄱ' },
    { id: 'unit-1', text: 'ㅏ' },
    { id: 'unit-2', text: 'ㅁ' },
  ],
  manipulationTargetUnitIds: ['unit-2'],
}

describe('SoundManipulationActivity', () => {
  beforeEach(() => {
    session.setAnswerCompletedHandler(null)
    session.resetSession()
    session.startLesson({
      id: 'final-delete-lesson',
      categoryId: 'phonological-awareness',
      title: '받침 빼기',
      description: '',
      activityType: 'sound-manipulation',
      estimatedMinutes: 1,
      questions: [question],
    })
  })

  it('두 번째 오답 후 정답 소리 카드가 반짝이고 가위로 표시된다', async () => {
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
          response: { selectedIndex: 2 },
        },
      }))
    const wrapper = mount(SoundManipulationActivity, { props: { question } })

    await wrapper.findAll('.sound-unit')[0]!.trigger('click')
    await wrapper.get('.action--check').trigger('click')
    await wrapper.get('.action--check').trigger('click')

    const answerCard = wrapper.findAll('.sound-unit')[2]!
    expect(answerCard.classes()).toContain('sound-unit--pulse')
    expect(answerCard.classes()).toContain('sound-unit--direct')
    expect(answerCard.find('.scissors').exists()).toBe(true)
    wrapper.unmount()
  })
})
