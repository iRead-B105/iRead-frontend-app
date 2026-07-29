import { beforeEach, describe, expect, it } from 'vitest'
import { useTrainingSession } from './useTrainingSession'

describe('useTrainingSession', () => {
  const session = useTrainingSession()

  beforeEach(() => {
    session.setAnswerEvaluator(null)
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

  it('목 데이터에서도 두 번째 오답 후 정답 힌트와 함께 문항을 완료한다', async () => {
    session.selectAnswer('choice-1')
    await expect(session.submitAnswer()).resolves.toBe(false)
    expect(session.progressState.attemptCount).toBe(1)
    expect(session.currentHint.value).not.toBeNull()

    session.selectAnswer('choice-1')
    await expect(session.submitAnswer()).resolves.toBe(true)
    expect(session.progressState.attemptCount).toBe(2)
    expect(session.progressState.hintLevel).toBe(2)
    expect(session.storedAnswers['question-1']).toBe('choice-0')
  })
})
