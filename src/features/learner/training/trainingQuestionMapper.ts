import type {
  HangulLetter,
  LetterBuildSlot,
  ReadingSentence,
  TrainingActivityType,
  TrainingChoice,
  TrainingQuestion,
  WordBreakdown,
  WordReadingItem,
} from '@/types/training'
import type {
  LearnerTrainingQuestionPayload,
  LearnerTrainingResponseType,
} from './repository'
import { getTraceAsset } from './traceAssets'

interface StudentQuestionDto {
  readonly questionType: string
  readonly responseType: LearnerTrainingResponseType
  readonly content: Readonly<Record<string, unknown>>
  readonly answer: Readonly<Record<string, unknown>>
  readonly requiredInputs: readonly string[]
  readonly recordingTargets: readonly {
    readonly targetIndex: number
    readonly text: string
  }[]
  readonly recommendedRecordingTargetIndex: number | null
}

export interface MappedTrainingQuestion {
  readonly questionNumber: number
  readonly totalQuestions: number
  readonly questionType: string
  readonly activityType: TrainingActivityType
  readonly responseType: LearnerTrainingResponseType
  readonly requiredInputs: readonly string[]
  readonly expectedText: string | null
  readonly recordingTargetIndex: number | null
  readonly question: TrainingQuestion
}

const responseTypes: readonly LearnerTrainingResponseType[] = [
  'TRACE',
  'SINGLE_CHOICE',
  'ORDERING',
  'COMPONENT_BUILD',
  'TEXT_INPUT',
  'AUDIO',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: Readonly<Record<string, unknown>>, field: string): string {
  const result = value[field]
  if (typeof result !== 'string' || result.trim() === '') {
    throw new TypeError(`백엔드 훈련 문항의 ${field} 값이 올바르지 않습니다.`)
  }
  return result
}

function optionalString(value: Readonly<Record<string, unknown>>, field: string): string | null {
  const result = value[field]
  return typeof result === 'string' && result.trim() !== '' ? result : null
}

function requiredInteger(value: Readonly<Record<string, unknown>>, field: string): number {
  const result = value[field]
  if (!Number.isInteger(result) || Number(result) < 0) {
    throw new TypeError(`백엔드 훈련 문항의 ${field} 값이 올바르지 않습니다.`)
  }
  return Number(result)
}

function stringArray(value: Readonly<Record<string, unknown>>, field: string): string[] {
  const result = value[field]
  if (!Array.isArray(result) || result.length === 0 || result.some((item) => typeof item !== 'string')) {
    throw new TypeError(`백엔드 훈련 문항의 ${field} 값이 올바르지 않습니다.`)
  }
  return [...result] as string[]
}

function objectArray(value: Readonly<Record<string, unknown>>, field: string): Record<string, unknown>[] {
  const result = value[field]
  if (!Array.isArray(result) || result.length === 0 || result.some((item) => !isRecord(item))) {
    throw new TypeError(`백엔드 훈련 문항의 ${field} 값이 올바르지 않습니다.`)
  }
  return result as Record<string, unknown>[]
}

function integerArray(value: Readonly<Record<string, unknown>>, field: string): number[] {
  const result = value[field]
  if (!Array.isArray(result) || result.length === 0 || result.some((item) => !Number.isInteger(item) || Number(item) < 0)) {
    throw new TypeError(`백엔드 훈련 문항의 ${field} 값이 올바르지 않습니다.`)
  }
  return result.map(Number)
}

function parseStudentQuestion(value: unknown): StudentQuestionDto {
  if (!isRecord(value) || !isRecord(value.content) || !isRecord(value.answer)) {
    throw new TypeError('백엔드 훈련 문항 형식이 올바르지 않습니다.')
  }
  const questionType = requiredString(value, 'questionType')
  const responseType = requiredString(value, 'responseType')
  if (!responseTypes.includes(responseType as LearnerTrainingResponseType)) {
    throw new TypeError(`지원하지 않는 훈련 응답 형식입니다: ${responseType}`)
  }
  return {
    questionType,
    responseType: responseType as LearnerTrainingResponseType,
    content: value.content,
    answer: value.answer,
    requiredInputs: Array.isArray(value.requiredInputs)
      ? value.requiredInputs.filter((input): input is string => typeof input === 'string')
      : [],
    recordingTargets: Array.isArray(value.recordingTargets)
      ? value.recordingTargets
        .filter((target): target is Record<string, unknown> => isRecord(target))
        .map((target) => ({
          targetIndex: requiredInteger(target, 'targetIndex'),
          text: requiredString(target, 'text'),
        }))
      : [],
    recommendedRecordingTargetIndex:
      Number.isInteger(value.recommendedRecordingTargetIndex)
        ? Number(value.recommendedRecordingTargetIndex)
        : null,
  }
}

const choiceId = (index: number) => `choice-${index}`
const unitId = (index: number) => `unit-${index}`
const choiceIndex = (id: string): number => {
  const match = /(?:choice|unit)-(\d+)$/.exec(id)
  if (!match) throw new TypeError(`선택지 식별자가 올바르지 않습니다: ${id}`)
  return Number(match[1])
}

function hangulLetter(text: string): HangulLetter | undefined {
  if (!/^[ㄱ-ㅎㅏ-ㅣ]$/.test(text)) return undefined
  return { jamo: text, type: /^[ㅏ-ㅣ]$/.test(text) ? 'vowel' : 'consonant' }
}

function choicesFromStrings(values: readonly string[]): TrainingChoice[] {
  return values.map((text, index) => ({
    id: choiceId(index),
    text,
    letter: hangulLetter(text),
  }))
}

function choicesFromUnknown(content: Readonly<Record<string, unknown>>): TrainingChoice[] {
  const values = content.choices
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError('백엔드 훈련 문항의 choices 값이 올바르지 않습니다.')
  }
  return values.map((value, index) => {
    if (typeof value === 'string') {
      return { id: choiceId(index), text: value, letter: hangulLetter(value) }
    }
    if (!isRecord(value)) throw new TypeError('백엔드 선택지 형식이 올바르지 않습니다.')
    const text = requiredString(value, 'text')
    return {
      id: choiceId(index),
      text,
      imageUrl: optionalString(value, 'imageUrl') ?? undefined,
    }
  })
}

function baseQuestion(
  number: number,
  instruction: string,
  answer: string,
): TrainingQuestion {
  return {
    id: `server-question-${number}`,
    instruction,
    answer,
    feedback: {
      correct: '정확하게 했어요!',
      retry: '힌트를 보고 한 번 더 해봐요.',
    },
  }
}

function mapTrace(number: number, source: StudentQuestionDto): TrainingQuestion {
  const target = requiredString(source.content, 'target')
  const soundText = requiredString(source.content, 'soundText')
  return {
    ...baseQuestion(number, '눈으로 글자를 따라가요', target),
    targetText: target,
    audioText: soundText,
    traceGlyph: target,
    traceStrokes: getTraceAsset(requiredString(source.content, 'traceAssetKey')),
    speechAliases: [target, soundText],
  }
}

function mapChoice(number: number, source: StudentQuestionDto): {
  activityType: TrainingActivityType
  question: TrainingQuestion
} {
  const answer = choiceId(requiredInteger(source.answer, 'answerIndex'))
  const isConsonantVowelClassification =
    source.questionType === 'CONSONANT_VOWEL_CLASSIFICATION'
  const choices = choicesFromUnknown(source.content).map((choice) => ({
    ...choice,
    text: isConsonantVowelClassification
      ? ({
          CONSONANT: '자음',
          VOWEL: '모음',
        } as const)[choice.text as 'CONSONANT' | 'VOWEL'] ?? choice.text
      : choice.text,
  }))
  const audioText = optionalString(source.content, 'audioText')
    ?? optionalString(source.content, 'targetAudioText')
    ?? ''
  const audioLetterTypes = new Set([
    'CONSONANT_SOUND_CHOICE',
    'VOWEL_SOUND_CHOICE',
    'SYLLABLE_INITIAL_CHOICE',
    'WORD_INITIAL_CHOICE',
  ])
  const activityType: TrainingActivityType =
    source.questionType === 'SIMILAR_SOUND_CHOICE'
      ? 'sound-choice'
      : audioLetterTypes.has(source.questionType)
        ? 'audio-letter-choice'
        : 'listen-and-select'
  const question = {
    ...baseQuestion(
      number,
      isConsonantVowelClassification
        ? '자음·모음을 골라봐요'
        : '소리를 듣고 알맞은 것을 골라요',
      answer,
    ),
    audioText,
    targetText: source.questionType === 'SAME_INITIAL_WORD_CHOICE' ? audioText : undefined,
    targetImage: optionalString(source.content, 'imageUrl') ?? undefined,
    choiceAudioEnabled: !isConsonantVowelClassification,
    choices,
  }
  return { activityType, question }
}

function mapOrdering(number: number, source: StudentQuestionDto): {
  activityType: TrainingActivityType
  question: TrainingQuestion
} {
  const cards = stringArray(source.content, 'cards')
  const order = integerArray(source.answer, 'answerOrder')
  const answer = order.map(choiceId).join('|')
  if (source.questionType === 'SENTENCE_ASSEMBLY') {
    return {
      activityType: 'sound-blend',
      question: {
        ...baseQuestion(number, '낱말 카드를 순서대로 놓아요', answer),
        soundParts: cards,
        choices: choicesFromStrings(cards),
        targetResult: requiredString(source.answer, 'completedSentence'),
      },
    }
  }
  return {
    activityType: 'sound-blend',
    question: {
      ...baseQuestion(number, '소리 카드를 순서대로 놓아요', answer),
      soundParts: stringArray(source.content, 'audioParts'),
      choices: choicesFromStrings(cards),
      targetResult: requiredString(source.answer, 'result'),
    },
  }
}

function mapComponentBuild(number: number, source: StudentQuestionDto): TrainingQuestion {
  const slotSpecs: Array<[LetterBuildSlot['role'], string, string]> = [
    ['initial', 'initialChoices', 'initialAnswerIndex'],
    ['medial', 'medialChoices', 'medialAnswerIndex'],
  ]
  if (Array.isArray(source.content.finalChoices)) {
    slotSpecs.push(['final', 'finalChoices', 'finalAnswerIndex'])
  }
  const choices: TrainingChoice[] = []
  const buildSlots: LetterBuildSlot[] = slotSpecs.map(([role, choicesField, answerField]) => {
    const values = stringArray(source.content, choicesField)
    const slotChoices = values.map((text, index) => ({
      id: `${role}-${choiceId(index)}`,
      text,
      letter: hangulLetter(text),
    }))
    choices.push(...slotChoices)
    return {
      id: role,
      role,
      answerChoiceId: `${role}-${choiceId(requiredInteger(source.answer, answerField))}`,
      hintText: role === 'initial' ? '첫소리' : role === 'medial' ? '가운데 소리' : '받침',
    }
  })
  const answer = buildSlots.map((slot) => slot.answerChoiceId).join('|')
  return {
    ...baseQuestion(number, '소리를 듣고 글자를 만들어요', answer),
    audioText: requiredString(source.content, 'targetAudioText'),
    combined: requiredString(source.answer, 'result'),
    choices,
    buildSlots,
  }
}

function mapManipulation(number: number, source: StudentQuestionDto): TrainingQuestion {
  const sourceText = requiredString(source.content, 'source')
  const targetResult = requiredString(source.answer, 'result')
  if (source.questionType === 'SYLLABLE_REPLACE') {
    const units = [...sourceText].map((text, index) => ({ id: unitId(index), text }))
    const replacements = choicesFromStrings(stringArray(source.content, 'choices'))
    const replaceIndex = requiredInteger(source.answer, 'replaceIndex')
    const answerIndex = requiredInteger(source.answer, 'answerIndex')
    const answer = `${unitId(replaceIndex)}:${choiceId(answerIndex)}`
    return {
      ...baseQuestion(number, '바꿀 음절과 새 음절을 골라요', answer),
      targetText: sourceText,
      audioText: requiredString(source.content, 'targetAudioText'),
      manipulationMode: 'replace',
      manipulationUnits: units,
      manipulationTargetUnitIds: [unitId(replaceIndex)],
      replacementChoices: replacements,
      replacementAnswerId: choiceId(answerIndex),
      targetResult,
    }
  }
  const values = source.questionType === 'SYLLABLE_DELETE'
    ? stringArray(source.content, 'syllables')
    : stringArray(source.content, 'removableUnits')
  const deleteIndex = source.questionType === 'SYLLABLE_DELETE'
    ? requiredInteger(source.answer, 'deleteIndex')
    : requiredInteger(source.answer, 'answerIndex')
  return {
    ...baseQuestion(number, '빼야 할 소리를 골라요', unitId(deleteIndex)),
    targetText: sourceText,
    audioText: requiredString(source.content, 'targetAudioText'),
    manipulationMode: 'remove',
    manipulationUnits: values.map((text, index) => ({ id: unitId(index), text })),
    manipulationTargetUnitIds: [unitId(deleteIndex)],
    targetResult,
  }
}

function readingWords(content: Readonly<Record<string, unknown>>): WordReadingItem[] {
  const values = content.words
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError('백엔드 훈련 문항의 words 값이 올바르지 않습니다.')
  }
  return values.map((value, index) => ({
    id: `word-${index}`,
    text: typeof value === 'string' ? value : requiredString(value as Record<string, unknown>, 'text'),
  }))
}

function mapAudio(number: number, source: StudentQuestionDto): {
  activityType: TrainingActivityType
  expectedText: string
  question: TrainingQuestion
} {
  const expectedText = requiredString(source.answer, 'expectedText')
  if (['WORD_READING', 'NONWORD_READING'].includes(source.questionType)) {
    return {
      activityType: 'word-reading-grid',
      expectedText,
      question: {
        ...baseQuestion(number, '낱말을 소리 내어 읽어요', expectedText),
        targetText: expectedText,
        readingWords: readingWords(source.content),
      },
    }
  }
  if (['SENTENCE_READING', 'SHORT_PASSAGE_READING'].includes(source.questionType)) {
    const sentences: ReadingSentence[] = source.questionType === 'SENTENCE_READING'
      ? [{ id: 'sentence-0', chunks: stringArray(source.content, 'tokens') }]
      : stringArray(source.content, 'sentences').map((text, index) => ({
        id: `sentence-${index}`,
        chunks: text.split(/\s+/),
      }))
    return {
      activityType: 'sentence-reading',
      expectedText,
      question: {
        ...baseQuestion(number, '처음부터 차례대로 읽어요', expectedText),
        targetText: expectedText,
        readingSentences: sentences,
      },
    }
  }
  let phraseChunks: string[] = []
  let focusWord: WordBreakdown | undefined
  if (source.questionType === 'DIFFICULT_WORD_PREVIEW') {
    const difficult = objectArray(source.content, 'difficultWords')[0]
    if (!difficult) throw new TypeError('어려운 단어 정보가 없습니다.')
    focusWord = {
      word: requiredString(difficult, 'word'),
      syllables: stringArray(difficult, 'syllables'),
    }
    phraseChunks = expectedText.split(/\s+/)
  } else if (source.questionType === 'PHRASE_READING') {
    phraseChunks = stringArray(source.content, 'phrases')
  } else if (source.questionType === 'WORD_CHAIN_READING') {
    phraseChunks = stringArray(source.content, 'words')
  } else if (source.questionType === 'SHORT_STORY_READING') {
    phraseChunks = objectArray(source.content, 'sentences')
      .map((sentence) => requiredString(sentence, 'text'))
  } else {
    phraseChunks = [expectedText]
  }
  return {
    activityType: 'read-aloud',
    expectedText,
    question: {
      ...baseQuestion(number, '소리 내어 읽어요', expectedText),
      targetText: expectedText,
      phraseChunks,
      focusWord,
    },
  }
}

function mapFillBlank(number: number, source: StudentQuestionDto): TrainingQuestion {
  if (source.content.inputType !== 'CHOICE' || source.responseType !== 'SINGLE_CHOICE') {
    throw new TypeError('빈칸 채우기는 선택형 문항만 지원합니다.')
  }
  const answer = choiceId(requiredInteger(source.answer, 'answerIndex'))
  return {
    ...baseQuestion(number, '빈칸에 들어갈 말을 골라요', answer),
    targetText: requiredString(source.content, 'sentence'),
    choices: choicesFromStrings(stringArray(source.content, 'choices')),
    targetResult: requiredString(source.answer, 'completedSentence'),
  }
}

export function mapTrainingQuestion(payload: LearnerTrainingQuestionPayload): MappedTrainingQuestion {
  const source = parseStudentQuestion(payload.question)
  let activityType: TrainingActivityType
  let question: TrainingQuestion
  let expectedText: string | null = null
  let recordingTargetIndex: number | null = null

  if (['VOWEL_TRACE', 'CONSONANT_TRACE', 'SYLLABLE_TRACE'].includes(source.questionType)) {
    activityType = 'gaze-trace'
    question = mapTrace(payload.questionNumber, source)
    expectedText = requiredString(source.content, 'soundText')
  } else if (source.questionType === 'FILL_IN_THE_BLANK') {
    activityType = 'listen-and-select'
    question = mapFillBlank(payload.questionNumber, source)
  } else if (source.responseType === 'SINGLE_CHOICE') {
    const mapped = source.questionType.endsWith('_DELETE') || source.questionType === 'SYLLABLE_REPLACE'
      ? { activityType: 'sound-manipulation' as const, question: mapManipulation(payload.questionNumber, source) }
      : mapChoice(payload.questionNumber, source)
    activityType = mapped.activityType
    question = mapped.question
  } else if (source.responseType === 'ORDERING') {
    const mapped = mapOrdering(payload.questionNumber, source)
    activityType = mapped.activityType
    question = mapped.question
  } else if (source.responseType === 'COMPONENT_BUILD') {
    activityType = 'letter-build'
    question = mapComponentBuild(payload.questionNumber, source)
  } else if (source.responseType === 'AUDIO') {
    const mapped = mapAudio(payload.questionNumber, source)
    activityType = mapped.activityType
    expectedText = mapped.expectedText
    question = mapped.question
  } else {
    throw new TypeError(`아직 화면에 연결되지 않은 훈련 문항입니다: ${source.questionType}`)
  }

  if (source.requiredInputs.includes('VOICE') && source.recordingTargets.length > 0) {
    const preferred = source.recordingTargets.find(
      (target) => target.targetIndex === source.recommendedRecordingTargetIndex,
    ) ?? source.recordingTargets[0]
    expectedText = preferred?.text ?? expectedText
    recordingTargetIndex = preferred?.targetIndex ?? null
  }

  return {
    questionNumber: payload.questionNumber,
    totalQuestions: payload.totalQuestions,
    questionType: source.questionType,
    activityType,
    responseType: source.responseType,
    requiredInputs: source.requiredInputs,
    expectedText,
    recordingTargetIndex,
    question,
  }
}

export function buildTrainingResponse(
  mapped: MappedTrainingQuestion,
  selectedAnswer: string | string[],
): Readonly<Record<string, unknown>> {
  const value = Array.isArray(selectedAnswer) ? selectedAnswer.join('|') : selectedAnswer
  switch (mapped.responseType) {
    case 'SINGLE_CHOICE': {
      const lastPart = value.includes(':') ? value.split(':').at(-1) ?? value : value
      return { selectedIndex: choiceIndex(lastPart) }
    }
    case 'ORDERING':
      return { orderedIndexes: value.split('|').map(choiceIndex) }
    case 'COMPONENT_BUILD':
      return {
        selections: value.split('|').map((id) => {
          const [role] = id.split('-choice-')
          return {
            slot: role?.toUpperCase(),
            selectedIndex: choiceIndex(`choice-${id.split('-choice-')[1]}`),
          }
        }),
      }
    case 'TEXT_INPUT':
      return { text: value }
    default:
      throw new TypeError(`선택 응답으로 제출할 수 없는 형식입니다: ${mapped.responseType}`)
  }
}
