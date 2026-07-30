// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { useTrainingSession } from '@/composables/useTrainingSession'
import type { TrainingQuestion } from '@/types/training'
import ListenAndSelectActivity from './ListenAndSelectActivity.vue'

describe('ListenAndSelectActivity', () => {
  it('자음·모음 분류에서는 목표 소리만 재생하고 한글 선택지를 표시한다', () => {
    const question: TrainingQuestion = {
      id: 'classification',
      instruction: '자음·모음을 골라봐요',
      answer: 'choice-0',
      audioText: 'ㄱ',
      choiceAudioEnabled: false,
      choices: [
        { id: 'choice-0', text: '자음' },
        { id: 'choice-1', text: '모음' },
      ],
    }
    const session = useTrainingSession()
    session.resetSession()
    session.startLesson({
      id: 'classification-lesson',
      categoryId: 'phonological-awareness',
      title: '자음·모음 분류',
      description: '',
      activityType: 'listen-and-select',
      estimatedMinutes: 1,
      questions: [question],
    })

    const wrapper = mount(ListenAndSelectActivity, { props: { question } })

    expect(wrapper.findAll('.target-area .sound-button')).toHaveLength(1)
    expect(wrapper.findAll('.word-choice .sound-button')).toHaveLength(0)
    expect(wrapper.text()).toContain('자음')
    expect(wrapper.text()).toContain('모음')
    expect(wrapper.text()).not.toContain('CONSONANT')
    expect(wrapper.text()).not.toContain('VOWEL')
    wrapper.unmount()
  })
})
