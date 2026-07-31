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
    expect(wrapper.get('.complete-button').attributes('disabled')).toBeDefined()

    await cards[2]!.trigger('click')
    expect(wrapper.findAll('.build-slot')[1]!.text()).toContain('ㅏ')
    expect(wrapper.get('.complete-button').attributes('disabled')).toBeUndefined()

    await wrapper.get('.complete-button').trigger('click')
    expect(session.progressState.isCurrentCorrect).toBe(true)
    expect(wrapper.get('.complete-button').classes()).toContain('complete-button--success')
    expect(wrapper.find('.shared-next-source').exists()).toBe(true)
    wrapper.unmount()
  })

  it('Enter 키로도 카드를 배치한다', async () => {
    const wrapper = mount(LetterBuildActivity, { props: { question } })

    await wrapper.findAll('.letter-chip')[0]!.trigger('keydown', { key: 'Enter' })

    expect(wrapper.findAll('.build-slot')[0]!.text()).toContain('ㄱ')
    wrapper.unmount()
  })

  it('겹받침은 서로 맞닿는 두 칸으로 나누어 표시한다', () => {
    const compoundQuestion: TrainingQuestion = {
      ...question,
      id: 'double-final-build',
      answer: 'initial-choice-0|medial-choice-0|final-choice-0',
      combined: '닭',
      choices: [
        ...question.choices!,
        { id: 'final-choice-0', text: 'ㄺ' },
      ],
      buildSlots: [
        ...question.buildSlots!,
        {
          id: 'final',
          role: 'final',
          answerChoiceId: 'final-choice-0',
          hintText: '받침',
        },
      ],
    }
    session.startLesson({
      id: 'double-final-build-lesson',
      categoryId: 'phonics',
      title: '겹받침 글자 만들기',
      description: '',
      activityType: 'letter-build',
      estimatedMinutes: 1,
      questions: [compoundQuestion],
    })

    const wrapper = mount(LetterBuildActivity, { props: { question: compoundQuestion } })
    const finalSlots = wrapper.findAll('.build-slot--final')

    expect(finalSlots).toHaveLength(2)
    expect(finalSlots[0]!.classes()).toContain('build-slot--part-0')
    expect(finalSlots[1]!.classes()).toContain('build-slot--part-1')
    expect(wrapper.findAll('.letter-chip').map((card) => card.text())).toEqual(
      expect.arrayContaining(['ㄹ', 'ㄱ']),
    )
    wrapper.unmount()
  })

  it('가로 모음 글자는 초성·중성·받침을 세로 세 칸으로 쌓는다', () => {
    const verticalQuestion: TrainingQuestion = {
      ...question,
      id: 'horizontal-vowel-build',
      answer: 'initial-choice-0|medial-choice-u|final-choice-b',
      combined: '흡',
      choices: [
        { id: 'initial-choice-0', text: 'ㅎ' },
        { id: 'medial-choice-u', text: 'ㅡ' },
        { id: 'final-choice-b', text: 'ㅂ' },
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
          answerChoiceId: 'medial-choice-u',
          hintText: '가운데 소리',
        },
        {
          id: 'final',
          role: 'final',
          answerChoiceId: 'final-choice-b',
          hintText: '받침',
        },
      ],
    }
    session.startLesson({
      id: 'horizontal-vowel-build-lesson',
      categoryId: 'phonics',
      title: '가로 모음 글자 만들기',
      description: '',
      activityType: 'letter-build',
      estimatedMinutes: 1,
      questions: [verticalQuestion],
    })

    const wrapper = mount(LetterBuildActivity, { props: { question: verticalQuestion } })

    expect(wrapper.get('.slot-row').classes()).toContain('slot-row--vertical-stack')
    expect(wrapper.findAll('.build-slot')).toHaveLength(3)
    wrapper.unmount()
  })

  it('복합 모음은 중성 영역을 두 칸으로 나누어 표시한다', () => {
    const compoundMedialQuestion: TrainingQuestion = {
      ...question,
      id: 'compound-medial-build',
      answer: 'initial-choice-0|medial-choice-wa',
      combined: '과',
      choices: [
        { id: 'initial-choice-0', text: 'ㄱ' },
        { id: 'medial-choice-wa', text: 'ㅘ' },
      ],
      buildSlots: [
        question.buildSlots![0]!,
        {
          id: 'medial',
          role: 'medial',
          answerChoiceId: 'medial-choice-wa',
          hintText: '가운데 소리',
        },
      ],
    }
    session.startLesson({
      id: 'compound-medial-build-lesson',
      categoryId: 'phonics',
      title: '복합 모음 글자 만들기',
      description: '',
      activityType: 'letter-build',
      estimatedMinutes: 1,
      questions: [compoundMedialQuestion],
    })

    const wrapper = mount(LetterBuildActivity, { props: { question: compoundMedialQuestion } })

    expect(wrapper.get('.slot-row').classes()).toContain('slot-row--compound-medial')
    expect(wrapper.findAll('.build-slot--medial')).toHaveLength(2)
    wrapper.unmount()
  })
})
