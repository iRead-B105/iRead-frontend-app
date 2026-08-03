// @vitest-environment jsdom

import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { useTrainingSession } from '@/composables/useTrainingSession'
import type { TrainingActivityType, TrainingQuestion } from '@/types/training'
import SoundButton from '@/components/training/SoundButton.vue'
import GazeTraceActivity from './GazeTraceActivity.vue'
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

  afterEach(() => {
    vi.useRealTimers()
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

    await vi.waitFor(() => expect(session.progressState.isCurrentCorrect).toBe(true))
    expect(wrapper.find('.start-button').exists()).toBe(false)
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
    startQuestion('word-reading-grid', question)
    const wrapper = mount(SentenceReadingActivity, { props: { question } })

    await vi.waitFor(() => expect(session.progressState.isCurrentCorrect).toBe(true))
    expect(wrapper.find('.start-button').exists()).toBe(false)
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
    startQuestion('word-reading-grid', question)
    const wrapper = mount(ReadAloudActivity, { props: { question } })

    await vi.waitFor(() => expect(session.progressState.isCurrentCorrect).toBe(true))
    expect(wrapper.get('.mic-button').element.tagName).toBe('DIV')
    expect(wrapper.get('.action--primary').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('따라 보기를 마치면 발음을 재생한 뒤 아동 음성을 자동 수음한다', async () => {
    vi.useFakeTimers()
    const question: TrainingQuestion = {
      id: 'vowel-trace',
      instruction: '글자를 따라가 보세요.',
      answer: 'ㅏ',
      traceGlyph: 'ㅏ',
      targetText: 'ㅏ',
      traceStrokes: [[
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ]],
    }
    startQuestion('gaze-trace', question)
    const wrapper = mount(GazeTraceActivity, { props: { question } })

    ;(wrapper.vm as unknown as { progress: number }).progress = 2
    await nextTick()
    await Promise.resolve()
    await nextTick()

    expect(session.progressState.isCurrentCorrect).toBe(null)
    expect(wrapper.get('.speech-panel').classes()).toContain('speech-panel--listening')
    expect(wrapper.get('.speech-panel').text()).toContain('말하는 중이에요!')
    await vi.runAllTimersAsync()
    await nextTick()

    expect(session.progressState.isCurrentCorrect).toBe(true)
    expect(wrapper.find('.mic-button').exists()).toBe(false)
    expect(wrapper.find('.speech-glyph').exists()).toBe(false)
    expect(wrapper.findComponent(SoundButton).exists()).toBe(true)
    expect(wrapper.findComponent(SoundButton).props('text')).toBe('아')
    expect(wrapper.find('.resume-point').exists()).toBe(false)
    expect(wrapper.find('.complete-ring').exists()).toBe(false)
    expect(wrapper.find('.next-button').exists()).toBe(true)
    wrapper.unmount()
  })
})
