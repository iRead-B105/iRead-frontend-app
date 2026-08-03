import { describe, expect, it } from 'vitest'
import { buildTrainingResponse, mapTrainingQuestion } from './trainingQuestionMapper'

describe('backend training question mapper', () => {
  it('VOWEL_TRACE 문항을 시선 따라 보기 화면 모델로 변환한다', () => {
    const mapped = mapTrainingQuestion({
      trainingId: '4001',
      questionNumber: 1,
      totalQuestions: 1,
      question: {
        questionType: 'VOWEL_TRACE',
        responseType: 'TRACE',
        content: {
          target: 'ㅏ',
          soundText: 'ㅏ',
          vowelType: 'BASIC',
          traceAssetKey: 'vowel_a',
        },
        answer: { target: 'ㅏ' },
        requiredInputs: ['VOICE', 'GAZE'],
      },
    })

    expect(mapped.activityType).toBe('gaze-trace')
    expect(mapped.responseType).toBe('TRACE')
    expect(mapped.requiredInputs).toEqual(['VOICE', 'GAZE'])
    expect(mapped.question.traceGlyph).toBe('ㅏ')
    expect(mapped.question.traceStrokes).toHaveLength(2)
    expect(mapped.question.traceStrokes?.[0]?.at(-1)?.x).toBe(
      mapped.question.traceStrokes?.[0]?.[0]?.x,
    )
    expect(mapped.question.traceStrokes?.[1]?.at(-1)?.x).toBeGreaterThan(
      mapped.question.traceStrokes?.[1]?.[0]?.x ?? Number.POSITIVE_INFINITY,
    )
  })

  it('SYLLABLE_BLEND 문항을 순서 응답 화면으로 변환한다', () => {
    const mapped = mapTrainingQuestion({
      trainingId: '4002',
      questionNumber: 1,
      totalQuestions: 1,
      question: {
        questionType: 'SYLLABLE_BLEND',
        responseType: 'ORDERING',
        content: {
          audioParts: ['사', '과'],
          cards: ['과', '사', '나'],
        },
        answer: { answerOrder: [1, 0], result: '사과' },
        requiredInputs: ['VOICE'],
      },
    })

    expect(mapped.activityType).toBe('sound-blend')
    expect(mapped.question.answer).toBe('choice-1|choice-0')
    expect(buildTrainingResponse(mapped, mapped.question.answer)).toEqual({
      orderedIndexes: [1, 0],
    })
  })

  it('IMAGE_SENTENCE_MATCH의 이미지 URL과 녹음 대상을 연결한다', () => {
    const mapped = mapTrainingQuestion({
      trainingId: '4003',
      questionNumber: 1,
      totalQuestions: 1,
      question: {
        questionType: 'IMAGE_SENTENCE_MATCH',
        responseType: 'SINGLE_CHOICE',
        content: {
          imagePrompt: '우산을 쓰는 아이',
          imageUrl: 'http://localhost:8000/api/v1/images/mock/example.svg',
          choices: ['비가 와요.', '눈이 와요.'],
        },
        answer: { answerIndex: 0 },
        requiredInputs: ['VOICE', 'GAZE'],
        recordingTargets: [
          { targetIndex: 0, text: '비가 와요.' },
          { targetIndex: 1, text: '눈이 와요.' },
        ],
        recommendedRecordingTargetIndex: 0,
      },
    })

    expect(mapped.activityType).toBe('sentence-choice')
    expect(mapped.question.targetImage)
      .toBe('http://localhost:8000/api/v1/images/mock/example.svg')
    expect(mapped.expectedText).toBe('비가 와요.')
    expect(mapped.recordingTargetIndex).toBe(0)
    expect(buildTrainingResponse(mapped, 'choice-0')).toEqual({ selectedIndex: 0 })
  })

  it('CONSONANT_VOWEL_CLASSIFICATION 내부 값을 한글 선택지로 표시한다', () => {
    const mapped = mapTrainingQuestion({
      trainingId: '4004',
      questionNumber: 1,
      totalQuestions: 1,
      question: {
        questionType: 'CONSONANT_VOWEL_CLASSIFICATION',
        responseType: 'SINGLE_CHOICE',
        content: {
          audioText: 'ㄱ',
          choices: ['CONSONANT', 'VOWEL'],
        },
        answer: { answerIndex: 0 },
        requiredInputs: [],
      },
    })

    expect(mapped.question.instruction).toBe('자음·모음을 골라봐요')
    expect(mapped.question.audioText).toBe('ㄱ')
    expect(mapped.question.choiceAudioEnabled).toBe(false)
    expect(mapped.question.choices?.map((choice) => choice.text))
      .toEqual(['자음', '모음'])
    expect(buildTrainingResponse(mapped, 'choice-0')).toEqual({ selectedIndex: 0 })
  })
})
