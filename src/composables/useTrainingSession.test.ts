import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTrainingSession } from './useTrainingSession'

describe('useTrainingSession', () => {
  const session = useTrainingSession()

  beforeEach(() => {
    session.setAnswerEvaluator(null)
    session.setAnswerCompletedHandler(null)
    session.resetSession()
    session.startLesson({
      id: 'lesson-1',
      categoryId: 'phonics',
      title: '소리 듣고 고르기',
      description: '',
      activityType: 'listen-and-select',
      estimatedMinutes: 1,
      questions: [
        {
          id: 'question-1',
          instruction: '정답을 고르세요.',
          answer: 'choice-0',
          choices: [
            { id: 'choice-0', text: 'ㅏ' },
            { id: 'choice-1', text: 'ㅓ' },
          ],
        },
      ],
    })
  })

  it('두 번째 오답 후 정답을 보여주고 정답을 골라야 문항을 완료한다', async () => {
    session.selectAnswer('choice-1')
    await expect(session.submitAnswer()).resolves.toBe(false)
    expect(session.progressState.attemptCount).toBe(1)
    expect(session.currentHint.value).not.toBeNull()

    session.selectAnswer('choice-1')
    await expect(session.submitAnswer()).resolves.toBe(false)
    expect(session.progressState.attemptCount).toBe(2)
    expect(session.progressState.hintLevel).toBe(2)
    expect(session.currentHint.value).toContain('ㅏ')
    expect(session.progressState.completedQuestionIds).toEqual([])

    session.selectAnswer('choice-0')
    await expect(session.submitAnswer()).resolves.toBe(true)
    expect(session.progressState.attemptCount).toBe(3)
    expect(session.storedAnswers['question-1']).toBe('choice-0')
  })

  it('서버가 정답 응답을 공개해도 정답 제출 전에는 다음 문제를 열지 않는다', async () => {
    const evaluate = vi.fn()
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
      })
      .mockResolvedValueOnce({
        attemptNo: 3,
        correct: true,
        questionCompleted: true,
        canRetry: false,
        hint: null,
        correctResponse: null,
      })
    session.setAnswerEvaluator(evaluate)

    session.selectAnswer('choice-1')
    await expect(session.submitAnswer()).resolves.toBe(false)
    expect(session.progressState.isCurrentCorrect).toBe(false)
    expect(session.progressState.completedQuestionIds).toEqual([])
    expect(session.currentHint.value).toContain('ㅏ')

    session.selectAnswer('choice-0')
    await expect(session.submitAnswer()).resolves.toBe(true)
    expect(session.progressState.isCurrentCorrect).toBe(true)
    expect(session.progressState.completedQuestionIds).toEqual(['question-1'])
  })

  it('서버가 문항 제출을 완료하면 등록된 다음 문항 핸들러를 한 번 호출한다', async () => {
    const onCompleted = vi.fn()
    session.setAnswerEvaluator(vi.fn().mockResolvedValue({
      attemptNo: 1,
      correct: true,
      questionCompleted: true,
      canRetry: false,
      hint: null,
      correctResponse: null,
    }))
    session.setAnswerCompletedHandler(onCompleted)

    session.selectAnswer('choice-1')
    await expect(session.submitAnswer()).resolves.toBe(true)

    expect(onCompleted).toHaveBeenCalledOnce()
  })

  it('서버에서 완료한 문항 다음부터 훈련을 이어서 시작한다', () => {
    session.startLesson({
      id: 'resume-lesson',
      categoryId: 'phonics',
      title: '이어 하기',
      description: '',
      activityType: 'listen-and-select',
      estimatedMinutes: 1,
      questions: [
        { id: 'resume-1', instruction: '첫 번째', answer: 'a', choices: [] },
        { id: 'resume-2', instruction: '두 번째', answer: 'b', choices: [] },
        { id: 'resume-3', instruction: '세 번째', answer: 'c', choices: [] },
      ],
    })

    session.restoreProgress([1, 2])

    expect(session.progressState.completedQuestionIds).toEqual(['resume-1', 'resume-2'])
    expect(session.progressState.currentQuestionIndex).toBe(2)
    expect(session.progressState.isCurrentCorrect).toBeNull()
  })
})
