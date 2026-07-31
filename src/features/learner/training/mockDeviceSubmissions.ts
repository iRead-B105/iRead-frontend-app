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
export const mockVoiceSubmissionsEnabled = parseBooleanEnv(
  import.meta.env.VITE_MOCK_VOICE_SUBMISSIONS,
  mockDeviceSubmissionsEnabled,
)
export const mockGazeSubmissionsEnabled = parseBooleanEnv(
  import.meta.env.VITE_MOCK_GAZE_SUBMISSIONS,
  mockDeviceSubmissionsEnabled,
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
  readonly targetIndex?: number
  readonly tokenIndex?: number
  readonly text?: string
}

const DEFAULT_SAMPLE_INTERVAL_MS = 80
const MAX_SAMPLE_GAP_MS = 250
const MIN_FIXATION_MS = 100

function wordTokensForQuestion(question: MappedTrainingQuestion): string[] {
  if (question.question.readingSentences?.length) {
    return question.question.readingSentences.flatMap((sentence) => sentence.chunks)
  }
  if (question.question.readingWords?.length) {
    return question.question.readingWords.map((word) => word.text)
  }
  const sourceText =
    question.expectedText
    ?? question.question.targetText
    ?? question.question.targetResult
    ?? ''
  return wordsFrom(sourceText)
}

type WordAccumulator = {
  dwellMs: number
  visitCount: number
  regressionCount: number
  firstSeenMs: number | null
  lastSeenMs: number | null
}

type ActiveSegment = {
  tokenIndex: number
  startMs: number
  endMs: number
  dwellMs: number
}

function createWordMetrics(
  questions: readonly MappedTrainingQuestion[],
  samples: readonly DeviceGazeSample[],
): MockGazeSubmission['words'] {
  return questions
    .filter((question) => question.requiredInputs.includes('GAZE'))
    .flatMap((question) => {
      const questionSamples = samples.filter((sample) =>
        sample.questionNumber === question.questionNumber,
      ).sort((first, second) => first.capturedAtMs - second.capturedAtMs)
      const tokens = wordTokensForQuestion(question)
      const questionStartMs = questionSamples[0]?.capturedAtMs ?? 0
      const accumulators = tokens.map<WordAccumulator>(() => ({
        dwellMs: 0,
        visitCount: 0,
        regressionCount: 0,
        firstSeenMs: null,
        lastSeenMs: null,
      }))
      const hitSamples = questionSamples.filter((sample) =>
        Number.isInteger(sample.tokenIndex)
        && Number(sample.tokenIndex) >= 0
        && Number(sample.tokenIndex) < tokens.length,
      )

      let activeSegment: ActiveSegment | null = null
      let previousAcceptedTokenIndex: number | null = null
      const finishSegment = () => {
        if (!activeSegment || activeSegment.dwellMs < MIN_FIXATION_MS) return
        const accumulator = accumulators[activeSegment.tokenIndex]
        if (!accumulator) return
        accumulator.dwellMs += Math.round(activeSegment.dwellMs)
        accumulator.visitCount += 1
        const firstSeenMs = Math.max(0, Math.round(activeSegment.startMs - questionStartMs))
        const lastSeenMs = Math.max(firstSeenMs, Math.round(activeSegment.endMs - questionStartMs))
        accumulator.firstSeenMs = accumulator.firstSeenMs === null
          ? firstSeenMs
          : Math.min(accumulator.firstSeenMs, firstSeenMs)
        accumulator.lastSeenMs = accumulator.lastSeenMs === null
          ? lastSeenMs
          : Math.max(accumulator.lastSeenMs, lastSeenMs)
        if (
          previousAcceptedTokenIndex !== null
          && activeSegment.tokenIndex < previousAcceptedTokenIndex
        ) {
          accumulator.regressionCount += 1
        }
        previousAcceptedTokenIndex = activeSegment.tokenIndex
      }

      hitSamples.forEach((sample, index) => {
        const tokenIndex = Number(sample.tokenIndex)
        const nextSample = hitSamples[index + 1]
        const previousSample = hitSamples[index - 1]
        const nextGap = nextSample
          ? nextSample.capturedAtMs - sample.capturedAtMs
          : previousSample
            ? sample.capturedAtMs - previousSample.capturedAtMs
            : DEFAULT_SAMPLE_INTERVAL_MS
        const sampleDwellMs = Math.max(
          0,
          Math.min(
            Number.isFinite(nextGap) && nextGap > 0 ? nextGap : DEFAULT_SAMPLE_INTERVAL_MS,
            MAX_SAMPLE_GAP_MS,
          ),
        )
        const shouldContinueSegment =
          activeSegment
          && activeSegment.tokenIndex === tokenIndex
          && sample.capturedAtMs - activeSegment.endMs <= MAX_SAMPLE_GAP_MS

        if (!shouldContinueSegment) {
          finishSegment()
          activeSegment = {
            tokenIndex,
            startMs: sample.capturedAtMs,
            endMs: sample.capturedAtMs + sampleDwellMs,
            dwellMs: sampleDwellMs,
          }
          return
        }

        if (!activeSegment) return
        activeSegment.endMs = sample.capturedAtMs + sampleDwellMs
        activeSegment.dwellMs += sampleDwellMs
      })
      finishSegment()

      return tokens.map((text, tokenIndex) => {
        const accumulator = accumulators[tokenIndex]
        return {
        questionNo: question.questionNumber,
        targetIndex: question.recordingTargetIndex ?? 0,
        tokenIndex,
        text,
        dwellMs: accumulator?.dwellMs ?? 0,
        visitCount: accumulator?.visitCount ?? 0,
        regressionCount: accumulator?.regressionCount ?? 0,
        firstSeenMs: accumulator?.firstSeenMs ?? 0,
        lastSeenMs: accumulator?.lastSeenMs ?? 0,
      }
      })
    })
}

export function createMockGazeSubmission(
  questions: readonly MappedTrainingQuestion[],
): MockGazeSubmission {
  const gazeQuestions = questions.filter((question) =>
    question.requiredInputs.includes('GAZE'),
  )
  const baseTime = Date.now()
  const samples = gazeQuestions.flatMap((question, questionIndex) =>
    wordTokensForQuestion(question).flatMap((text, tokenIndex) => [
      {
        x: 320 + (tokenIndex % 3) * 80,
        y: 240 + (questionIndex % 2) * 60,
        capturedAtMs: baseTime + questionIndex * 2_000 + tokenIndex * 300,
        questionNumber: question.questionNumber,
        targetIndex: question.recordingTargetIndex ?? 0,
        tokenIndex,
        text,
      },
      {
        x: 320 + (tokenIndex % 3) * 80,
        y: 240 + (questionIndex % 2) * 60,
        capturedAtMs: baseTime + questionIndex * 2_000 + tokenIndex * 300 + 80,
        questionNumber: question.questionNumber,
        targetIndex: question.recordingTargetIndex ?? 0,
        tokenIndex,
        text,
      },
    ]),
  )

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
