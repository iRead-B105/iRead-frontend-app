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

    expect(gazeData.samples).toHaveLength(4)
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
      { x: 320, y: 240, capturedAtMs: 1_000, questionNumber: 1, tokenIndex: 0, text: 'alpha' },
      { x: 322, y: 242, capturedAtMs: 1_080, questionNumber: 1, tokenIndex: 0, text: 'alpha' },
      { x: 420, y: 240, capturedAtMs: 1_300, questionNumber: 1, tokenIndex: 1, text: 'beta' },
      { x: 422, y: 242, capturedAtMs: 1_380, questionNumber: 1, tokenIndex: 1, text: 'beta' },
      { x: 320, y: 240, capturedAtMs: 1_700, questionNumber: 1, tokenIndex: 0, text: 'alpha' },
      { x: 322, y: 242, capturedAtMs: 1_780, questionNumber: 1, tokenIndex: 0, text: 'alpha' },
    ])

    expect(gazeData.samples).toHaveLength(6)
    expect(gazeData.words).toHaveLength(2)
    expect(gazeData.words[0]).toMatchObject({ text: 'alpha', visitCount: 2, regressionCount: 1 })
    expect(gazeData.words[1]).toMatchObject({ text: 'beta', visitCount: 1, regressionCount: 0 })
    expect(gazeData.words[0]?.dwellMs).not.toBe(gazeData.words[1]?.dwellMs)
  })
})
