import type { MappedTrainingQuestion } from './trainingQuestionMapper'

// 실제 장치 연동 전까지 API 모드의 VOICE/GAZE 필수 입력을 목데이터로 제출한다.
function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue
  if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true
  if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false
  throw new TypeError(
    `[아동 환경설정] VITE_MOCK_DEVICE_SUBMISSIONS는 true 또는 false여야 합니다. 현재 값: ${value}`,
  )
}

export const mockDeviceSubmissionsEnabled = parseBooleanEnv(
  import.meta.env.VITE_MOCK_DEVICE_SUBMISSIONS,
  true,
)

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

export interface DeviceGazeSample {
  readonly x: number
  readonly y: number
  readonly capturedAtMs: number
  readonly questionNumber: number
}

function createWordMetrics(
  questions: readonly MappedTrainingQuestion[],
  samples: readonly DeviceGazeSample[],
): MockGazeSubmission['words'] {
  return questions
    .filter((question) => question.requiredInputs.includes('GAZE'))
    .flatMap((question) => {
      const sourceText =
        question.expectedText
        ?? question.question.targetText
        ?? question.question.targetResult
        ?? ''
      const questionSamples = samples.filter((sample) =>
        sample.questionNumber === question.questionNumber,
      )
      const firstSeenMs = 0
      const lastSeenMs = questionSamples.length > 0
        ? Math.max(240, questionSamples.length * 80)
        : 0
      return wordsFrom(sourceText).map((text, tokenIndex) => ({
        questionNo: question.questionNumber,
        targetIndex: question.recordingTargetIndex ?? 0,
        tokenIndex,
        text,
        dwellMs: lastSeenMs,
        visitCount: questionSamples.length > 0 ? Math.max(1, questionSamples.length) : 0,
        regressionCount: 0,
        firstSeenMs,
        lastSeenMs,
      }))
    })
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

  return {
    schemaVersion: 1,
    samples,
    words: createWordMetrics(questions, samples),
  }
}

export function createRealGazeSubmission(
  questions: readonly MappedTrainingQuestion[],
  samples: readonly DeviceGazeSample[],
): MockGazeSubmission {
  return {
    schemaVersion: 1,
    samples,
    words: createWordMetrics(questions, samples),
  }
}
