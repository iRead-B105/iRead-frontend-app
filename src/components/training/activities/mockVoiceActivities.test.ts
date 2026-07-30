// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { useTrainingSession } from '@/composables/useTrainingSession'
import type { TrainingActivityType, TrainingQuestion } from '@/types/training'
import WordReadingGridActivity from './WordReadingGridActivity.vue'
import SentenceReadingActivity from './SentenceReadingActivity.vue'
import ReadAloudActivity from './ReadAloudActivity.vue'

const session = useTrainingSession()

const startQuestion = (
  activityType: TrainingActivityType,
  question: TrainingQuestion,
) => {
  session.resetSession()
  session.startLesson({
    id: `mock-${activityType}`,
    categoryId: 'fluency',
    title: '목 음성 훈련',
    description: '',
    activityType,
    estimatedMinutes: 1,
    questions: [question],
  })
}

describe('mock voice activities', () => {
  beforeEach(() => {
    session.setAnswerEvaluator(null)
    session.setAnswerCompletedHandler(null)
    session.resetSession()
  })

  it('낱말 읽기를 마이크 없이 완료한다', async () => {
    const question: TrainingQuestion = {
      id: 'word-reading',
      instruction: '낱말을 읽어요',
      answer: '사과 나무',
      readingWords: [
        { id: 'word-1', text: '사과' },
        { id: 'word-2', text: '나무' },
      ],
    }
    startQuestion('word-reading-grid', question)
    const wrapper = mount(WordReadingGridActivity, { props: { question } })

    await wrapper.get('.start-button').trigger('click')

    expect(session.progressState.isCurrentCorrect).toBe(true)
    expect(wrapper.find('.next-button').exists()).toBe(true)
    wrapper.unmount()
  })

  it('문장 읽기를 마이크 없이 완료한다', async () => {
    const question: TrainingQuestion = {
      id: 'sentence-reading',
      instruction: '문장을 읽어요',
      answer: '아기는 사과를 먹는다.',
      readingSentences: [{
        id: 'sentence-1',
        chunks: ['아기는', '사과를', '먹는다'],
      }],
    }
    startQuestion('sentence-reading', question)
    const wrapper = mount(SentenceReadingActivity, { props: { question } })

    await wrapper.get('.start-button').trigger('click')

    expect(session.progressState.isCurrentCorrect).toBe(true)
    expect(wrapper.find('.next-button').exists()).toBe(true)
    wrapper.unmount()
  })

  it('따라 읽기를 마이크 없이 완료한다', async () => {
    const question: TrainingQuestion = {
      id: 'read-aloud',
      instruction: '소리 내어 읽어요',
      answer: '아기는 사과를 먹는다.',
      targetText: '아기는 사과를 먹는다.',
      phraseChunks: ['아기는', '사과를', '먹는다.'],
    }
    startQuestion('read-aloud', question)
    const wrapper = mount(ReadAloudActivity, { props: { question } })

    await wrapper.get('.mic-button').trigger('click')

    expect(session.progressState.isCurrentCorrect).toBe(true)
    expect(wrapper.get('.action--primary').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})
