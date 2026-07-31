import { describe, expect, it } from 'vitest'
import type { MappedTrainingQuestion } from './trainingQuestionMapper'
import {
  createMockGazeSubmission,
  createRealGazeSubmission,
  createMockVoiceFile,
  mockDeviceSubmissionsEnabled,
  mockGazeSubmissionsEnabled,
  mockVoiceSubmissionsEnabled,
} from './mockDeviceSubmissions'

const mappedQuestion = (
  overrides: Partial<MappedTrainingQuestion> = {},
): MappedTrainingQuestion => ({
  questionNumber: 1,
  totalQuestions: 1,
  questionType: 'SYLLABLE_BLEND',
  activityType: 'sound-blend',
  responseType: 'ORDERING',
  requiredInputs: ['VOICE', 'GAZE'],
  expectedText: '나무를 읽어요',
  recordingTargetIndex: 0,
  question: {
    id: 'server-question-1',
    instruction: '소리를 합쳐요',
    answer: 'choice-1|choice-0',
  },
  ...overrides,
})

const samplesForToken = (
  tokenIndex: number,
  text: string,
  startMs: number,
  count: number,
) => Array.from({ length: count }, (_, index) => ({
  x: 320 + tokenIndex * 100,
  y: 240,
  capturedAtMs: startMs + index * 200,
  questionNumber: 1,
  tokenIndex,
  text,
}))

describe('mock device submissions', () => {
  it('장치 목데이터 제출을 기본으로 활성화한다', () => {
    expect(mockDeviceSubmissionsEnabled).toBe(true)
    expect(mockVoiceSubmissionsEnabled).toBe(true)
    expect(mockGazeSubmissionsEnabled).toBe(true)
  })

  it('백엔드 업로드 정책에 맞는 비어 있지 않은 WAV 파일을 만든다', async () => {
    const file = createMockVoiceFile(3)
    const header = new TextDecoder().decode((await file.arrayBuffer()).slice(0, 12))

    expect(file.name).toBe('mock-training-3.wav')
    expect(file.type).toBe('audio/wav')
    expect(file.size).toBeGreaterThan(44)
    expect(header).toContain('RIFF')
    expect(header).toContain('WAVE')
  })

  it('GAZE 필수 문항의 샘플과 단어 지표를 생성한다', () => {
    const gazeData = createMockGazeSubmission([
      mappedQuestion(),
      mappedQuestion({
        questionNumber: 2,
        requiredInputs: ['VOICE'],
        expectedText: '제외할 문장',
      }),
    ])

    expect(gazeData.samples).toHaveLength(24)
    expect(gazeData.samples[0]).toMatchObject({ questionNumber: 1 })
    expect(gazeData.words).toEqual([
      expect.objectContaining({
        questionNo: 1,
        targetIndex: 0,
        tokenIndex: 0,
        text: '나무를',
        visitCount: 1,
      }),
      expect.objectContaining({
        questionNo: 1,
        targetIndex: 0,
        tokenIndex: 1,
        text: '읽어요',
        visitCount: 1,
      }),
    ])
  })

  it('real gaze samples create token-specific backend-compatible word metrics', () => {
    const gazeData = createRealGazeSubmission([
      mappedQuestion({
        expectedText: 'alpha beta',
        question: {
          ...mappedQuestion().question,
          targetText: 'alpha beta',
          readingSentences: [{ id: 'sentence-0', chunks: ['alpha', 'beta'] }],
        },
      }),
    ], [
      ...samplesForToken(0, 'alpha', 1_000, 12),
      ...samplesForToken(1, 'beta', 4_000, 6),
      ...samplesForToken(0, 'alpha', 6_000, 12),
    ])

    expect(gazeData.samples).toHaveLength(30)
    expect(gazeData.words).toHaveLength(2)
    expect(gazeData.words[0]).toMatchObject({
      text: 'alpha',
      dwellMs: 4_850,
      visitCount: 2,
      readCount: 2,
      skipped: false,
      regressionCount: 1,
    })
    expect(gazeData.words[1]).toMatchObject({
      text: 'beta',
      dwellMs: 0,
      visitCount: 0,
      readCount: 1,
      skipped: false,
      regressionCount: 0,
    })
    expect(gazeData.words[0]?.dwellMs).not.toBe(gazeData.words[1]?.dwellMs)
  })

  it('uses full expected text tokens for sentence reading gaze metrics', () => {
    const gazeData = createRealGazeSubmission([
      mappedQuestion({
        expectedText: 'alpha beta gamma',
        question: {
          ...mappedQuestion().question,
          targetText: 'alpha beta gamma',
          readingSentences: [{ id: 'sentence-0', chunks: ['gamma'] }],
        },
      }),
    ], [
      ...samplesForToken(2, 'gamma', 1_000, 12),
    ])

    expect(gazeData.words.map((word) => word.text)).toEqual(['alpha', 'beta', 'gamma'])
    expect(gazeData.words[0]).toMatchObject({ tokenIndex: 0, visitCount: 0, readCount: 0, skipped: true })
    expect(gazeData.words[1]).toMatchObject({ tokenIndex: 1, visitCount: 0, readCount: 0, skipped: true })
    expect(gazeData.words[2]).toMatchObject({
      tokenIndex: 2,
      text: 'gamma',
      dwellMs: 2_400,
      visitCount: 1,
      readCount: 1,
      skipped: false,
    })
  })

  it('marks a word as skipped when the reader passes it and returns later', () => {
    const gazeData = createRealGazeSubmission([
      mappedQuestion({
        expectedText: 'alpha beta gamma',
        question: {
          ...mappedQuestion().question,
          targetText: 'alpha beta gamma',
          readingSentences: [{ id: 'sentence-0', chunks: ['alpha', 'beta', 'gamma'] }],
        },
      }),
    ], [
      ...samplesForToken(0, 'alpha', 1_000, 12),
      ...samplesForToken(2, 'gamma', 4_000, 12),
      ...samplesForToken(1, 'beta', 7_000, 12),
    ])

    expect(gazeData.words[0]).toMatchObject({
      tokenIndex: 0,
      readCount: 1,
      skipped: false,
      regressionCount: 0,
    })
    expect(gazeData.words[1]).toMatchObject({
      tokenIndex: 1,
      readCount: 1,
      skipped: true,
      regressionCount: 1,
    })
    expect(gazeData.words[2]).toMatchObject({
      tokenIndex: 2,
      readCount: 1,
      skipped: false,
      regressionCount: 0,
    })
  })
})
