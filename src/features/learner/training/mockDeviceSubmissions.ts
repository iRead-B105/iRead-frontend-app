import type { MappedTrainingQuestion } from './trainingQuestionMapper'

// 실제 장치 연동 전까지 API 모드의 VOICE/GAZE 필수 입력을 목데이터로 제출한다.
export const mockDeviceSubmissionsEnabled = true

const MOCK_SAMPLE_RATE = 8_000
const MOCK_AUDIO_DURATION_MS = 250

const writeAscii = (view: DataView, offset: number, value: string): void => {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

export function createMockVoiceFile(questionNumber: number): File {
  const sampleCount = Math.floor(MOCK_SAMPLE_RATE * MOCK_AUDIO_DURATION_MS / 1_000)
  const bytesPerSample = 2
  const dataSize = sampleCount * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, MOCK_SAMPLE_RATE, true)
  view.setUint32(28, MOCK_SAMPLE_RATE * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  return new File([buffer], `mock-training-${questionNumber}.wav`, {
    type: 'audio/wav',
  })
}

const wordsFrom = (value: string): string[] =>
  value.match(/[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]+/g) ?? []

export interface MockGazeSubmission {
  readonly schemaVersion: 1
  readonly samples: readonly {
    readonly x: number
    readonly y: number
    readonly capturedAtMs: number
    readonly questionNumber: number
  }[]
  readonly words: readonly {
    readonly questionNo: number
    readonly targetIndex: number
    readonly tokenIndex: number
    readonly text: string
    readonly dwellMs: number
    readonly visitCount: number
    readonly regressionCount: number
    readonly firstSeenMs: number
    readonly lastSeenMs: number
  }[]
}

export function createMockGazeSubmission(
  questions: readonly MappedTrainingQuestion[],
): MockGazeSubmission {
  const gazeQuestions = questions.filter((question) =>
    question.requiredInputs.includes('GAZE'),
  )
  const baseTime = Date.now()
  const samples = gazeQuestions.map((question, index) => ({
    x: 320 + (index % 3) * 80,
    y: 240 + (index % 2) * 60,
    capturedAtMs: baseTime + index * 500,
    questionNumber: question.questionNumber,
  }))
  const words = gazeQuestions.flatMap((question) => {
    const sourceText =
      question.expectedText
      ?? question.question.targetText
      ?? question.question.targetResult
      ?? ''
    return wordsFrom(sourceText).map((text, tokenIndex) => ({
      questionNo: question.questionNumber,
      targetIndex: question.recordingTargetIndex ?? 0,
      tokenIndex,
      text,
      dwellMs: 420,
      visitCount: 1,
      regressionCount: 0,
      firstSeenMs: tokenIndex * 500,
      lastSeenMs: tokenIndex * 500 + 420,
    }))
  })

  return {
    schemaVersion: 1,
    samples,
    words,
  }
}
