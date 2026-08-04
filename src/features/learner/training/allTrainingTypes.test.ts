import { describe, expect, it } from 'vitest'
import { trainingActivityComponents } from '@/components/training/activityRegistry'
import { getTrainingTemplateMapping } from '@/features/learner/content/trainingTemplateMapping'
import type { TrainingActivityType } from '@/types/training'
import type {
  LearnerTrainingQuestionPayload,
  LearnerTrainingResponseType,
} from './repository'
import { buildTrainingResponse, mapTrainingQuestion } from './trainingQuestionMapper'

interface TrainingTypeFixture {
  readonly templateId: number
  readonly questionType: string
  readonly responseType: LearnerTrainingResponseType
  readonly activityType: TrainingActivityType
  readonly content: Readonly<Record<string, unknown>>
  readonly answer: Readonly<Record<string, unknown>>
}

const fixtures: readonly TrainingTypeFixture[] = [
  { templateId: 1, questionType: 'VOWEL_TRACE', responseType: 'TRACE', activityType: 'gaze-trace', content: { target: 'ㅏ', soundText: 'ㅏ', traceAssetKey: 'vowel_0' }, answer: { target: 'ㅏ' } },
  { templateId: 2, questionType: 'CONSONANT_TRACE', responseType: 'TRACE', activityType: 'gaze-trace', content: { target: 'ㄱ', soundText: 'ㄱ', traceAssetKey: 'consonant_0' }, answer: { target: 'ㄱ' } },
  { templateId: 3, questionType: 'SYLLABLE_TRACE', responseType: 'TRACE', activityType: 'gaze-trace', content: { target: '가', soundText: '가', traceAssetKey: 'syllable_0' }, answer: { target: '가' } },
  { templateId: 4, questionType: 'CONSONANT_SOUND_CHOICE', responseType: 'SINGLE_CHOICE', activityType: 'audio-letter-choice', content: { audioText: 'ㄱ', choices: ['ㄱ', 'ㄴ', 'ㄷ'] }, answer: { answerIndex: 0 } },
  { templateId: 5, questionType: 'VOWEL_SOUND_CHOICE', responseType: 'SINGLE_CHOICE', activityType: 'audio-letter-choice', content: { audioText: 'ㅏ', choices: ['ㅏ', 'ㅓ', 'ㅗ'] }, answer: { answerIndex: 0 } },
  { templateId: 6, questionType: 'CONSONANT_VOWEL_CLASSIFICATION', responseType: 'SINGLE_CHOICE', activityType: 'listen-and-select', content: { audioText: 'ㄱ', choices: ['CONSONANT', 'VOWEL'] }, answer: { answerIndex: 0 } },
  { templateId: 7, questionType: 'SYLLABLE_INITIAL_CHOICE', responseType: 'SINGLE_CHOICE', activityType: 'audio-letter-choice', content: { audioText: '가', choices: ['ㄱ', 'ㄴ', 'ㄷ'] }, answer: { answerIndex: 0 } },
  { templateId: 8, questionType: 'WORD_INITIAL_CHOICE', responseType: 'SINGLE_CHOICE', activityType: 'audio-letter-choice', content: { audioText: '사과', choices: ['ㅅ', 'ㄱ', 'ㄴ'] }, answer: { answerIndex: 0 } },
  { templateId: 9, questionType: 'SAME_INITIAL_WORD_CHOICE', responseType: 'SINGLE_CHOICE', activityType: 'listen-and-select', content: { targetAudioText: '사과', choices: [{ text: '수박' }, { text: '기차' }, { text: '연필' }] }, answer: { answerIndex: 0 } },
  { templateId: 10, questionType: 'FINAL_CONSONANT_CHOICE', responseType: 'SINGLE_CHOICE', activityType: 'listen-and-select', content: { audioText: '각', choices: ['ㄱ', 'ㄴ', 'ㄹ'] }, answer: { answerIndex: 0 } },
  { templateId: 11, questionType: 'WORD_FINAL_SOUND_CHOICE', responseType: 'SINGLE_CHOICE', activityType: 'listen-and-select', content: { audioText: '산', choices: ['ㄴ', 'ㄱ', 'ㅁ'] }, answer: { answerIndex: 0 } },
  { templateId: 12, questionType: 'FINAL_CONSONANT_COMPARISON', responseType: 'SINGLE_CHOICE', activityType: 'listen-and-select', content: { audioText: '각', choices: ['각', '간', '갈'] }, answer: { answerIndex: 0 } },
  { templateId: 13, questionType: 'SIMILAR_SOUND_CHOICE', responseType: 'SINGLE_CHOICE', activityType: 'sound-choice', content: { audioText: '가', choices: ['가', '카', '까'] }, answer: { answerIndex: 0 } },
  { templateId: 14, questionType: 'PHONEME_BLEND', responseType: 'ORDERING', activityType: 'sound-blend', content: { audioParts: ['ㄱ', 'ㅏ'], cards: ['ㄱ', 'ㅏ', 'ㄴ'] }, answer: { answerOrder: [0, 1], result: '가' } },
  { templateId: 15, questionType: 'SYLLABLE_BLEND', responseType: 'ORDERING', activityType: 'sound-blend', content: { audioParts: ['사', '과'], cards: ['사', '과', '나'] }, answer: { answerOrder: [0, 1], result: '사과' } },
  { templateId: 16, questionType: 'BASIC_SYLLABLE_BUILD', responseType: 'COMPONENT_BUILD', activityType: 'letter-build', content: { targetAudioText: '가', initialChoices: ['ㄱ', 'ㄴ'], medialChoices: ['ㅏ', 'ㅓ'] }, answer: { initialAnswerIndex: 0, medialAnswerIndex: 0, result: '가' } },
  { templateId: 17, questionType: 'FINAL_SYLLABLE_BUILD', responseType: 'COMPONENT_BUILD', activityType: 'letter-build', content: { targetAudioText: '각', initialChoices: ['ㄱ', 'ㄴ'], medialChoices: ['ㅏ', 'ㅓ'], finalChoices: ['ㄱ', 'ㄴ'] }, answer: { initialAnswerIndex: 0, medialAnswerIndex: 0, finalAnswerIndex: 0, result: '각' } },
  { templateId: 18, questionType: 'DOUBLE_FINAL_BUILD', responseType: 'COMPONENT_BUILD', activityType: 'letter-build', content: { targetAudioText: '닭', initialChoices: ['ㄷ', 'ㄱ'], medialChoices: ['ㅏ', 'ㅓ'], finalChoices: ['ㄺ', 'ㄱ'] }, answer: { initialAnswerIndex: 0, medialAnswerIndex: 0, finalAnswerIndex: 0, result: '닭' } },
  { templateId: 19, questionType: 'FINAL_CONSONANT_DELETE', responseType: 'SINGLE_CHOICE', activityType: 'sound-omit', content: { source: '감', targetAudioText: '가', removableUnits: ['ㄱ', 'ㅏ', 'ㅁ'] }, answer: { answerIndex: 2, result: '가' } },
  { templateId: 20, questionType: 'SYLLABLE_DELETE', responseType: 'SINGLE_CHOICE', activityType: 'sound-omit', content: { source: '사과', targetAudioText: '과', syllables: ['사', '과'] }, answer: { deleteIndex: 0, result: '과' } },
  { templateId: 21, questionType: 'SYLLABLE_REPLACE', responseType: 'SINGLE_CHOICE', activityType: 'sound-manipulation', content: { source: '사과', targetAudioText: '나과', replaceIndex: 0, choices: ['나', '다'] }, answer: { replaceIndex: 0, answerIndex: 0, result: '나과' } },
  { templateId: 22, questionType: 'WORD_READING', responseType: 'AUDIO', activityType: 'word-reading-grid', content: { words: ['사과', '나무', '바다'] }, answer: { expectedText: '사과 나무 바다' } },
  { templateId: 23, questionType: 'NONWORD_READING', responseType: 'AUDIO', activityType: 'word-reading-grid', content: { words: [{ text: '나무' }, { text: '두미' }] }, answer: { expectedText: '나무 두미' } },
  { templateId: 24, questionType: 'DIFFICULT_WORD_PREVIEW', responseType: 'AUDIO', activityType: 'word-reading-grid', content: { difficultWords: [{ word: '사과', syllables: ['사', '과'] }], sentence: '아기는 사과를 먹는다.' }, answer: { expectedText: '아기는 사과를 먹는다.' } },
  { templateId: 25, questionType: 'SENTENCE_READING', responseType: 'AUDIO', activityType: 'word-reading-grid', content: { sentence: '아기는 사과를 먹는다.', tokens: ['아기는', '사과를', '먹는다'] }, answer: { expectedText: '아기는 사과를 먹는다.' } },
  { templateId: 26, questionType: 'SHORT_PASSAGE_READING', responseType: 'AUDIO', activityType: 'word-reading-grid', content: { sentences: ['아기는 사과를 먹는다.', '나무 위에서 새가 노래한다.'] }, answer: { expectedText: '아기는 사과를 먹는다. 나무 위에서 새가 노래한다.' } },
  { templateId: 27, questionType: 'SENTENCE_ASSEMBLY', responseType: 'ORDERING', activityType: 'sentence-order', content: { cards: ['사과를', '먹는다.', '아기는'] }, answer: { answerOrder: [2, 0, 1], completedSentence: '아기는 사과를 먹는다.' } },
  { templateId: 28, questionType: 'FILL_IN_THE_BLANK', responseType: 'SINGLE_CHOICE', activityType: 'fill-blank', content: { sentence: '책상 위에 {{blank}} 그림이 있다.', inputType: 'CHOICE', choices: ['사과', '기차', '연필'] }, answer: { answerIndex: 0, completedSentence: '책상 위에 사과 그림이 있다.' } },
  { templateId: 29, questionType: 'IMAGE_SENTENCE_MATCH', responseType: 'SINGLE_CHOICE', activityType: 'sentence-choice', content: { imagePrompt: '아기가 사과를 먹는 장면', choices: ['아기는 사과를 먹는다.', '비가 내린다.'] }, answer: { answerIndex: 0 } },
  { templateId: 30, questionType: 'SENTENCE_REPEAT', responseType: 'AUDIO', activityType: 'word-reading-grid', content: { sentence: '아기는 사과를 먹는다.', emotion: 'HAPPY' }, answer: { expectedText: '아기는 사과를 먹는다.' } },
  { templateId: 31, questionType: 'WORD_CHAIN_READING', responseType: 'AUDIO', activityType: 'word-reading-grid', content: { words: ['사과', '나무', '바다'], requiredOrder: 'SEQUENTIAL' }, answer: { expectedText: '사과 나무 바다' } },
  { templateId: 32, questionType: 'PHRASE_READING', responseType: 'AUDIO', activityType: 'word-reading-grid', content: { sentence: '아기는 사과를 먹는다.', phrases: ['아기는', '사과를 먹는다.'] }, answer: { expectedText: '아기는 사과를 먹는다.' } },
  { templateId: 33, questionType: 'REPEATED_SENTENCE_READING', responseType: 'AUDIO', activityType: 'word-reading-grid', content: { sentence: '아기는 사과를 먹는다.', repeatCount: 2 }, answer: { expectedText: '아기는 사과를 먹는다.' } },
  { templateId: 34, questionType: 'SHORT_STORY_READING', responseType: 'AUDIO', activityType: 'word-reading-grid', content: { title: '사과 이야기', sentences: [{ speaker: 'NARRATOR', text: '아기는 사과를 먹는다.' }, { speaker: 'CHARACTER', text: '정말 맛있어!' }] }, answer: { expectedText: '아기는 사과를 먹는다. 정말 맛있어!' } },
]

const listeningPromptTypes = new Set([
  'CONSONANT_SOUND_CHOICE',
  'VOWEL_SOUND_CHOICE',
  'CONSONANT_VOWEL_CLASSIFICATION',
  'SYLLABLE_INITIAL_CHOICE',
  'WORD_INITIAL_CHOICE',
  'SAME_INITIAL_WORD_CHOICE',
  'FINAL_CONSONANT_CHOICE',
  'WORD_FINAL_SOUND_CHOICE',
  'FINAL_CONSONANT_COMPARISON',
  'SIMILAR_SOUND_CHOICE',
  'PHONEME_BLEND',
  'SYLLABLE_BLEND',
  'BASIC_SYLLABLE_BUILD',
  'FINAL_SYLLABLE_BUILD',
  'DOUBLE_FINAL_BUILD',
  'FINAL_CONSONANT_DELETE',
  'SYLLABLE_DELETE',
  'SYLLABLE_REPLACE',
  'SENTENCE_REPEAT',
])

const audioPromptPolicyTypes = new Set([
  ...listeningPromptTypes,
  'DIFFICULT_WORD_PREVIEW',
  'SENTENCE_ASSEMBLY',
  'FILL_IN_THE_BLANK',
  'IMAGE_SENTENCE_MATCH',
  'WORD_CHAIN_READING',
  'PHRASE_READING',
  'REPEATED_SENTENCE_READING',
  'SHORT_STORY_READING',
])

describe('all backend training types', () => {
  it('DEV, training, and test choice screens share one Vue template', () => {
    expect(trainingActivityComponents['listen-and-select'])
      .toBe(trainingActivityComponents['audio-letter-choice'])
    expect(trainingActivityComponents['sound-choice'])
      .toBe(trainingActivityComponents['audio-letter-choice'])
  })

  it('34개 템플릿을 빠짐없이 포함한다', () => {
    expect(fixtures.map((fixture) => fixture.templateId)).toEqual(
      Array.from({ length: 34 }, (_, index) => index + 1),
    )
    expect(fixtures.every((fixture) => (
      getTrainingTemplateMapping(fixture.templateId) !== null
    ))).toBe(true)
  })

  it.each(fixtures)(
    '$templateId번 $questionType 문항을 화면과 제출 형식에 연결한다',
    (fixture) => {
      const payload: LearnerTrainingQuestionPayload = {
        trainingId: String(190100 + fixture.templateId),
        questionNumber: 1,
        totalQuestions: 1,
        question: {
          questionType: fixture.questionType,
          responseType: fixture.responseType,
          content: fixture.content,
          answer: fixture.answer,
          requiredInputs: [],
        },
      }

      const mapped = mapTrainingQuestion(payload)

      expect(mapped.activityType).toBe(fixture.activityType)
      expect(trainingActivityComponents[mapped.activityType]).toBeDefined()
      if (!['AUDIO', 'TRACE'].includes(mapped.responseType)) {
        expect(buildTrainingResponse(mapped, mapped.question.answer)).toBeTruthy()
      }
    },
  )

  it.each(fixtures.filter((fixture) => audioPromptPolicyTypes.has(fixture.questionType)))(
    '$questionType의 듣기 버튼 노출 정책을 명시한다',
    (fixture) => {
      const mapped = mapTrainingQuestion({
        trainingId: String(190100 + fixture.templateId),
        questionNumber: 1,
        totalQuestions: 1,
        question: {
          questionType: fixture.questionType,
          responseType: fixture.responseType,
          content: fixture.content,
          answer: fixture.answer,
          requiredInputs: [],
        },
      })

      expect(mapped.question.audioPromptEnabled)
        .toBe(listeningPromptTypes.has(fixture.questionType))
    },
  )

  it('maps passage reading to backend sentence recording targets', () => {
    const mapped = mapTrainingQuestion({
      trainingId: '141154',
      questionNumber: 1,
      totalQuestions: 1,
      question: {
        questionType: 'SHORT_PASSAGE_READING',
        responseType: 'AUDIO',
        content: { sentences: ['아기는 사과를 먹는다.', '나무 위에서 새가 노래한다.'] },
        answer: { expectedText: '아기는 사과를 먹는다. 나무 위에서 새가 노래한다.' },
        requiredInputs: ['VOICE', 'GAZE'],
        recordingTargets: [
          { targetIndex: 0, text: '아기는 사과를 먹는다.' },
          { targetIndex: 1, text: '나무 위에서 새가 노래한다.' },
        ],
        recommendedRecordingTargetIndex: 0,
      },
    })

    expect(mapped.question.readingItems).toEqual([
      { id: 'reading-0', text: '아기는', targetIndex: 0, tokenIndex: 0 },
      { id: 'reading-1', text: '사과를', targetIndex: 0, tokenIndex: 1 },
      { id: 'reading-2', text: '먹는다', targetIndex: 0, tokenIndex: 2 },
      { id: 'reading-3', text: '나무', targetIndex: 1, tokenIndex: 3 },
      { id: 'reading-4', text: '위에서', targetIndex: 1, tokenIndex: 4 },
      { id: 'reading-5', text: '새가', targetIndex: 1, tokenIndex: 5 },
      { id: 'reading-6', text: '노래한다', targetIndex: 1, tokenIndex: 6 },
    ])
  })
})
