// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { useTrainingSession } from '@/composables/useTrainingSession'
import type { TrainingActivityType, TrainingQuestion } from '@/types/training'
import AudioLetterChoiceActivity from './AudioLetterChoiceActivity.vue'
import ListenAndSelectActivity from './ListenAndSelectActivity.vue'
import SoundChoiceActivity from './SoundChoiceActivity.vue'

const session = useTrainingSession()
const choices = [
  {
    id: 'choice-0',
    text: 'ㄱ',
    letter: { jamo: 'ㄱ', type: 'consonant' as const },
  },
  {
    id: 'choice-1',
    text: 'ㄴ',
    letter: { jamo: 'ㄴ', type: 'consonant' as const },
  },
]

const start = (activityType: TrainingActivityType, question: TrainingQuestion) => {
  session.startLesson({
    id: `hint-${activityType}`,
    categoryId: 'phonological-awareness',
    title: '선택식 힌트',
    description: '',
    activityType,
    estimatedMinutes: 1,
    questions: [question],
  })
  session.progressState.hintLevel = 2
}

describe('selection answer card hints', () => {
  beforeEach(() => {
    session.setAnswerEvaluator(null)
    session.setAnswerCompletedHandler(null)
    session.resetSession()
  })

  it.each([
    ['audio-letter-choice', AudioLetterChoiceActivity],
    ['listen-and-select', ListenAndSelectActivity],
    ['sound-choice', SoundChoiceActivity],
  ] as const)('%s 정답 카드를 반짝임 대상으로 표시한다', (activityType, component) => {
    const question: TrainingQuestion = {
      id: `question-${activityType}`,
      instruction: '맞는 소리를 골라요',
      answer: 'choice-1',
      choices,
      choiceAudioEnabled: false,
    }
    start(activityType, question)

    const wrapper = mount(component, { props: { question } })

    expect(wrapper.findAll('.answer-hint')).toHaveLength(1)
    const renderedCards = wrapper.findAll('.letter-card')
    expect(renderedCards[0]!.classes()).not.toContain('answer-hint')
    expect(renderedCards[1]!.classes()).toContain('answer-hint')
    wrapper.unmount()
  })
})
