// 실제 장치(아이트래커/커서 폴백)에서 수집한 시선 샘플을
// 백엔드 시선 세션 종료 payload(단어 지표 포함)로 변환한다.
import type { MappedTrainingQuestion } from './trainingQuestionMapper'

const wordsFrom = (value: string): string[] =>
  value.match(/[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]+/g) ?? []

export interface GazeSubmission {
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
    readonly readCount: number
    readonly skipped: boolean
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
const READ_DWELL_MS = 1_000
const FIXATION_DWELL_MS = 2_000

type GazeWordPosition = {
  text: string
  targetIndex: number
  tokenIndex: number
}

function wordPositionsForQuestion(question: MappedTrainingQuestion): GazeWordPosition[] {
  if (question.question.readingItems?.length) {
    return question.question.readingItems.flatMap((item) => {
      const words = wordsFrom(item.text)
      // 백엔드는 (questionNo, targetIndex, tokenIndex)가 중복된 단어 지표를 거부한다.
      // 같은 문장의 청크들은 targetIndex를 공유하므로, 매퍼가 부여한 전역 tokenIndex를 써야
      // 청크마다 0부터 다시 세면서 생기는 중복을 막고 발음 시도 기록과도 짝이 맞는다.
      return words.map((text, tokenIndex) => ({
        text,
        targetIndex: item.targetIndex,
        tokenIndex: item.tokenIndex ?? tokenIndex,
      }))
    })
  }

  const expectedTokens = wordsFrom(question.expectedText ?? '')
  if (expectedTokens.length > 0) {
    return expectedTokens.map((text, tokenIndex) => ({
      text,
      targetIndex: question.recordingTargetIndex ?? 0,
      tokenIndex,
    }))
  }

  if (question.question.readingSentences?.length) {
    return question.question.readingSentences
      .flatMap((sentence) => sentence.chunks)
      .flatMap((text, targetIndex) => wordsFrom(text).map((word, tokenIndex) => ({
        text: word,
        targetIndex,
        tokenIndex,
      })))
  }
  if (question.question.readingWords?.length) {
    return question.question.readingWords.map((word, targetIndex) => ({
      text: word.text,
      targetIndex,
      tokenIndex: 0,
    }))
  }
  const sourceText =
    question.expectedText
    ?? question.question.targetText
    ?? question.question.targetResult
    ?? ''
  return wordsFrom(sourceText).map((text, tokenIndex) => ({
    text,
    targetIndex: question.recordingTargetIndex ?? 0,
    tokenIndex,
  }))
}

function wordTokensForQuestion(question: MappedTrainingQuestion): string[] {
  return wordPositionsForQuestion(question).map((position) => position.text)
}

type WordAccumulator = {
  dwellMs: number
  visitCount: number
  readCount: number
  skipped: boolean
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
): GazeSubmission['words'] {
  return questions
    .filter((question) => question.requiredInputs.includes('GAZE'))
    .flatMap((question) => {
      const questionSamples = samples.filter((sample) =>
        sample.questionNumber === question.questionNumber,
      ).sort((first, second) => first.capturedAtMs - second.capturedAtMs)
      const tokens = wordTokensForQuestion(question)
      const positions = wordPositionsForQuestion(question)
      const questionStartMs = questionSamples[0]?.capturedAtMs ?? 0
      const accumulators = tokens.map<WordAccumulator>(() => ({
        dwellMs: 0,
        visitCount: 0,
        readCount: 0,
        skipped: false,
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
      let previousReadTokenIndex: number | null = null
      const markSkippedWordsBefore = (tokenIndex: number) => {
        const startIndex = previousReadTokenIndex === null ? 0 : previousReadTokenIndex + 1
        if (tokenIndex <= startIndex) return
        for (let skippedIndex = startIndex; skippedIndex < tokenIndex; skippedIndex += 1) {
          const skippedAccumulator = accumulators[skippedIndex]
          if (skippedAccumulator && skippedAccumulator.readCount === 0) {
            skippedAccumulator.skipped = true
          }
        }
      }
      const finishSegment = () => {
        if (!activeSegment || activeSegment.dwellMs < READ_DWELL_MS) return
        const accumulator = accumulators[activeSegment.tokenIndex]
        if (!accumulator) return
        markSkippedWordsBefore(activeSegment.tokenIndex)
        accumulator.readCount += 1
        const firstSeenMs = Math.max(0, Math.round(activeSegment.startMs - questionStartMs))
        const lastSeenMs = Math.max(firstSeenMs, Math.round(activeSegment.endMs - questionStartMs))
        accumulator.firstSeenMs = accumulator.firstSeenMs === null
          ? firstSeenMs
          : Math.min(accumulator.firstSeenMs, firstSeenMs)
        accumulator.lastSeenMs = accumulator.lastSeenMs === null
          ? lastSeenMs
          : Math.max(accumulator.lastSeenMs, lastSeenMs)
        if (
          previousReadTokenIndex !== null
          && activeSegment.tokenIndex < previousReadTokenIndex
        ) {
          accumulator.regressionCount += 1
        }
        previousReadTokenIndex = activeSegment.tokenIndex
        if (activeSegment.dwellMs >= FIXATION_DWELL_MS) {
          accumulator.dwellMs += Math.round(activeSegment.dwellMs)
          accumulator.visitCount += 1
        }
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
        const position = positions[tokenIndex]
        return {
        questionNo: question.questionNumber,
        targetIndex: position?.targetIndex ?? question.recordingTargetIndex ?? 0,
        tokenIndex: position?.tokenIndex ?? tokenIndex,
        text,
        dwellMs: accumulator?.dwellMs ?? 0,
        visitCount: accumulator?.visitCount ?? 0,
        readCount: accumulator?.readCount ?? 0,
        skipped: (accumulator?.skipped ?? false) || (accumulator?.readCount ?? 0) === 0,
        regressionCount: accumulator?.regressionCount ?? 0,
        firstSeenMs: accumulator?.firstSeenMs ?? 0,
        lastSeenMs: accumulator?.lastSeenMs ?? 0,
      }
      })
    })
}

export function createGazeSubmission(
  questions: readonly MappedTrainingQuestion[],
  samples: readonly DeviceGazeSample[],
): GazeSubmission {
  return {
    schemaVersion: 1,
    samples,
    words: createWordMetrics(questions, samples),
  }
}
