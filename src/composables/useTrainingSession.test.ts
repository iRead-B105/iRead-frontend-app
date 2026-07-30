import { afterEach, describe, expect, it } from 'vitest'
import { useTrainingSession } from './useTrainingSession'
import type { TrainingLesson } from '@/types/training'

const lesson: TrainingLesson = {
  id: 'perfect-five',
  categoryId: 'phonics',
  title: '다섯 문제',
  description: '올정답 완료 상태를 확인한다.',
  activityType: 'sound-choice',
  estimatedMinutes: 5,
  questions: Array.from({ length: 5 }, (_, index) => ({
    id: `q${index + 1}`,
    instruction: '골라!',
    answer: 'correct',
  })),
}

const answerAllQuestions = (includeWrongAnswer = false) => {
  const session = useTrainingSession()
  session.startLesson(lesson)

  lesson.questions.forEach((_question, index) => {
    if (includeWrongAnswer && index === 1) {
      session.selectAnswer('wrong')
      expect(session.submitAnswer()).toBe(false)
    }
    session.selectAnswer('correct')
    expect(session.submitAnswer()).toBe(true)
    if (index < lesson.questions.length - 1) {
      expect(session.nextQuestion()).toBe(true)
    }
  })

  return session
}

describe('useTrainingSession perfect completion', () => {
  afterEach(() => {
    useTrainingSession().resetSession()
  })

  it('marks a five-question lesson perfect when no incorrect answer was submitted', () => {
    const session = answerAllQuestions()

    expect(session.progressState.completedQuestionIds).toHaveLength(5)
    expect(session.progressState.incorrectQuestionIds).toEqual([])
    expect(session.isPerfectLesson.value).toBe(true)
  })

  it('keeps the regular completion variant after any incorrect answer', () => {
    const session = answerAllQuestions(true)

    expect(session.progressState.completedQuestionIds).toHaveLength(5)
    expect(session.progressState.incorrectQuestionIds).toEqual(['q2'])
    expect(session.isPerfectLesson.value).toBe(false)
  })

  it('does not use the perfect variant for a lesson with a different question count', () => {
    const session = useTrainingSession()
    session.startLesson({ ...lesson, questions: lesson.questions.slice(0, 4) })

    lesson.questions.slice(0, 4).forEach((_question, index) => {
      session.selectAnswer('correct')
      session.submitAnswer()
      if (index < 3) session.nextQuestion()
    })

    expect(session.isPerfectLesson.value).toBe(false)
  })

  it('shows the first hint after the second incorrect attempt', () => {
    const session = useTrainingSession()
    session.startLesson(lesson)

    session.selectAnswer('wrong')
    expect(session.submitAnswer()).toBe(false)
    expect(session.progressState.hintLevel).toBe(0)

    session.selectAnswer('wrong-again')
    expect(session.submitAnswer()).toBe(false)
    expect(session.progressState.hintLevel).toBe(1)
  })
})
