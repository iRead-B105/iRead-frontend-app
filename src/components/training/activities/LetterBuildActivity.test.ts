// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { useTrainingSession } from '@/composables/useTrainingSession'
import type { TrainingQuestion } from '@/types/training'
import LetterBuildActivity from './LetterBuildActivity.vue'

const session = useTrainingSession()

const question: TrainingQuestion = {
  id: 'basic-syllable-build',
  instruction: '글자를 만들어봐요',
  answer: 'initial-choice-0|medial-choice-0',
  combined: '가',
  choices: [
    { id: 'initial-choice-0', text: 'ㄱ' },
    { id: 'initial-choice-1', text: 'ㄴ' },
    { id: 'medial-choice-0', text: 'ㅏ' },
    { id: 'medial-choice-1', text: 'ㅓ' },
  ],
  buildSlots: [
    {
      id: 'initial',
      role: 'initial',
      answerChoiceId: 'initial-choice-0',
      hintText: '첫소리',
    },
    {
      id: 'medial',
      role: 'medial',
      answerChoiceId: 'medial-choice-0',
      hintText: '가운데 소리',
    },
  ],
}

describe('LetterBuildActivity', () => {
  beforeEach(() => {
    session.setAnswerEvaluator(null)
    session.setAnswerCompletedHandler(null)
    session.resetSession()
    session.startLesson({
      id: 'basic-syllable-build-lesson',
      categoryId: 'phonics',
      title: '기본 글자 만들기',
      description: '',
      activityType: 'letter-build',
      estimatedMinutes: 1,
      questions: [question],
    })
  })

  it('카드를 클릭하면 알맞은 글자 칸에 배치한다', async () => {
    const wrapper = mount(LetterBuildActivity, { props: { question } })
    const cards = wrapper.findAll('.letter-chip')

    await cards[0]!.trigger('click')
    expect(wrapper.findAll('.build-slot')[0]!.text()).toContain('ㄱ')
    expect(wrapper.get('.action--check').attributes('disabled')).toBeDefined()

    await cards[2]!.trigger('click')
    expect(wrapper.findAll('.build-slot')[1]!.text()).toContain('ㅏ')
    expect(wrapper.get('.action--check').attributes('disabled')).toBeUndefined()

    await wrapper.get('.action--check').trigger('click')
    expect(session.progressState.isCurrentCorrect).toBe(true)
    expect(wrapper.text()).toContain('가')
    wrapper.unmount()
  })

  it('Enter 키로도 카드를 배치한다', async () => {
    const wrapper = mount(LetterBuildActivity, { props: { question } })

    await wrapper.findAll('.letter-chip')[0]!.trigger('keydown', { key: 'Enter' })

    expect(wrapper.findAll('.build-slot')[0]!.text()).toContain('ㄱ')
    wrapper.unmount()
  })
})
