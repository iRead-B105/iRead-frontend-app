import type { TrainingCategoryId } from '@/types/training'

interface LearnerTrainingTemplateMapping {
  readonly categoryId: TrainingCategoryId
  readonly lessonId: string
}

const trainingTypeMappings = {
  VOWEL_TRACE: { categoryId: 'phonics', lessonId: 'trace-vowel' },
  CONSONANT_TRACE: { categoryId: 'phonics', lessonId: 'trace-consonant' },
  SYLLABLE_TRACE: { categoryId: 'phonics', lessonId: 'trace-syllable' },
  CONSONANT_SOUND_CHOICE: { categoryId: 'phonics', lessonId: 'letter-sound-choice' },
  VOWEL_SOUND_CHOICE: { categoryId: 'phonics', lessonId: 'letter-sound-choice' },
  SYLLABLE_INITIAL_CHOICE: {
    categoryId: 'phonological-awareness',
    lessonId: 'first-sound',
  },
  WORD_INITIAL_CHOICE: {
    categoryId: 'phonological-awareness',
    lessonId: 'word-first-sound-choice',
  },
  SAME_INITIAL_WORD_CHOICE: {
    categoryId: 'phonological-awareness',
    lessonId: 'same-sound',
  },
  FINAL_CONSONANT_CHOICE: { categoryId: 'phonics', lessonId: 'batchim-sound' },
  WORD_FINAL_SOUND_CHOICE: {
    categoryId: 'phonological-awareness',
    lessonId: 'last-sound',
  },
  FINAL_CONSONANT_COMPARISON: { categoryId: 'phonics', lessonId: 'batchim-sound' },
  SIMILAR_SOUND_CHOICE: { categoryId: 'phonics', lessonId: 'similar-sound' },
  SYLLABLE_BLEND: { categoryId: 'phonological-awareness', lessonId: 'sound-combine' },
  BASIC_SYLLABLE_BUILD: { categoryId: 'phonics', lessonId: 'build-basic-letter' },
  FINAL_SYLLABLE_BUILD: { categoryId: 'phonics', lessonId: 'build-batchim-letter' },
  DOUBLE_FINAL_BUILD: { categoryId: 'phonics', lessonId: 'build-double-batchim-letter' },
  FINAL_CONSONANT_DELETE: {
    categoryId: 'phonological-awareness',
    lessonId: 'remove-batchim',
  },
  SYLLABLE_DELETE: { categoryId: 'phonological-awareness', lessonId: 'sound-split' },
  SYLLABLE_REPLACE: { categoryId: 'phonological-awareness', lessonId: 'replace-syllable' },
  WORD_READING: { categoryId: 'fluency', lessonId: 'read-real-words' },
  NONWORD_READING: { categoryId: 'fluency', lessonId: 'read-nonwords' },
  SENTENCE_READING: { categoryId: 'fluency', lessonId: 'read-sentences' },
  SHORT_PASSAGE_READING: { categoryId: 'fluency', lessonId: 'read-short-passage' },
  SENTENCE_ASSEMBLY: { categoryId: 'short-text', lessonId: 'sentence-order' },
  FILL_IN_THE_BLANK: { categoryId: 'short-text', lessonId: 'fill-blank' },
  IMAGE_SENTENCE_MATCH: { categoryId: 'short-text', lessonId: 'match-picture' },
  SENTENCE_REPEAT: { categoryId: 'fluency', lessonId: 'follow-sentence' },
  WORD_CHAIN_READING: { categoryId: 'fluency', lessonId: 'word-chain' },
  PHRASE_READING: { categoryId: 'fluency', lessonId: 'phrase-reading' },
  REPEATED_SENTENCE_READING: { categoryId: 'fluency', lessonId: 're-read' },
  SHORT_STORY_READING: { categoryId: 'fluency', lessonId: 'short-story' },
} as const satisfies Readonly<Record<string, LearnerTrainingTemplateMapping>>

export type LearnerTrainingType = keyof typeof trainingTypeMappings

// 은퇴 템플릿(6 자음·모음 구별하기, 14 음소 합쳐 음절 만들기, 24 어려운 단어 먼저 읽기)은
// 백엔드 TrainingCatalogPolicy가 모든 경로에서 제외하므로 매핑에서도 제거했다.
const legacyTemplateTypes: Readonly<Record<number, LearnerTrainingType>> = {
  1: 'VOWEL_TRACE',
  2: 'CONSONANT_TRACE',
  3: 'SYLLABLE_TRACE',
  4: 'CONSONANT_SOUND_CHOICE',
  5: 'VOWEL_SOUND_CHOICE',
  7: 'SYLLABLE_INITIAL_CHOICE',
  8: 'WORD_INITIAL_CHOICE',
  9: 'SAME_INITIAL_WORD_CHOICE',
  10: 'FINAL_CONSONANT_CHOICE',
  11: 'WORD_FINAL_SOUND_CHOICE',
  12: 'FINAL_CONSONANT_COMPARISON',
  13: 'SIMILAR_SOUND_CHOICE',
  15: 'SYLLABLE_BLEND',
  16: 'BASIC_SYLLABLE_BUILD',
  17: 'FINAL_SYLLABLE_BUILD',
  18: 'DOUBLE_FINAL_BUILD',
  19: 'FINAL_CONSONANT_DELETE',
  20: 'SYLLABLE_DELETE',
  21: 'SYLLABLE_REPLACE',
  22: 'WORD_READING',
  23: 'NONWORD_READING',
  25: 'SENTENCE_READING',
  26: 'SHORT_PASSAGE_READING',
  27: 'SENTENCE_ASSEMBLY',
  28: 'FILL_IN_THE_BLANK',
  29: 'IMAGE_SENTENCE_MATCH',
  30: 'SENTENCE_REPEAT',
  31: 'WORD_CHAIN_READING',
  32: 'PHRASE_READING',
  33: 'REPEATED_SENTENCE_READING',
  34: 'SHORT_STORY_READING',
}

export const getTrainingTypeMapping = (
  trainingType: string,
): LearnerTrainingTemplateMapping | null => (
  trainingType in trainingTypeMappings
    ? trainingTypeMappings[trainingType as LearnerTrainingType]
    : null
)

export const resolveTrainingMapping = (
  trainingType: string | undefined,
  trainingTemplateId: number,
): LearnerTrainingTemplateMapping | null => {
  if (trainingType !== undefined) {
    return getTrainingTypeMapping(trainingType)
  }
  const legacyType = legacyTemplateTypes[trainingTemplateId]
  return legacyType ? trainingTypeMappings[legacyType] : null
}

/** 진행 가능한 훈련 템플릿 31종. 이름은 백엔드 training-templates.json과 동일하다. */
export interface SelectableTrainingTemplate {
  readonly templateId: number
  readonly name: string
  readonly trainingType: LearnerTrainingType
}

export const selectableTrainingTemplates: readonly SelectableTrainingTemplate[] = [
  { templateId: 1, name: '모음 따라 보기', trainingType: 'VOWEL_TRACE' },
  { templateId: 2, name: '자음 따라 보기', trainingType: 'CONSONANT_TRACE' },
  { templateId: 3, name: '음절 따라 보기', trainingType: 'SYLLABLE_TRACE' },
  { templateId: 4, name: '자음 소리 고르기', trainingType: 'CONSONANT_SOUND_CHOICE' },
  { templateId: 5, name: '모음 소리 고르기', trainingType: 'VOWEL_SOUND_CHOICE' },
  { templateId: 7, name: '음절의 첫소리 찾기', trainingType: 'SYLLABLE_INITIAL_CHOICE' },
  { templateId: 8, name: '낱말의 첫소리 찾기', trainingType: 'WORD_INITIAL_CHOICE' },
  { templateId: 9, name: '같은 첫소리 낱말 찾기', trainingType: 'SAME_INITIAL_WORD_CHOICE' },
  { templateId: 10, name: '받침 소리 고르기', trainingType: 'FINAL_CONSONANT_CHOICE' },
  { templateId: 11, name: '낱말의 끝소리 고르기', trainingType: 'WORD_FINAL_SOUND_CHOICE' },
  { templateId: 12, name: '서로 다른 받침 음절 비교하기', trainingType: 'FINAL_CONSONANT_COMPARISON' },
  { templateId: 13, name: '비슷한 소리 고르기', trainingType: 'SIMILAR_SOUND_CHOICE' },
  { templateId: 15, name: '음절 합쳐 낱말 만들기', trainingType: 'SYLLABLE_BLEND' },
  { templateId: 16, name: '기본 글자 만들기', trainingType: 'BASIC_SYLLABLE_BUILD' },
  { templateId: 17, name: '받침 글자 만들기', trainingType: 'FINAL_SYLLABLE_BUILD' },
  { templateId: 18, name: '겹받침 글자 만들기', trainingType: 'DOUBLE_FINAL_BUILD' },
  { templateId: 19, name: '받침 빼기', trainingType: 'FINAL_CONSONANT_DELETE' },
  { templateId: 20, name: '음절 빼기', trainingType: 'SYLLABLE_DELETE' },
  { templateId: 21, name: '음절 바꾸기', trainingType: 'SYLLABLE_REPLACE' },
  { templateId: 22, name: '낱말 읽기', trainingType: 'WORD_READING' },
  { templateId: 23, name: '새 낱말 읽기', trainingType: 'NONWORD_READING' },
  { templateId: 25, name: '어절별로 읽기', trainingType: 'SENTENCE_READING' },
  { templateId: 26, name: '짧은 글 읽기', trainingType: 'SHORT_PASSAGE_READING' },
  { templateId: 27, name: '문장 전체 조립', trainingType: 'SENTENCE_ASSEMBLY' },
  { templateId: 28, name: '빈칸에 알맞은 단어 넣기', trainingType: 'FILL_IN_THE_BLANK' },
  { templateId: 29, name: '그림과 문장 연결하기', trainingType: 'IMAGE_SENTENCE_MATCH' },
  { templateId: 30, name: '문장 따라 읽기', trainingType: 'SENTENCE_REPEAT' },
  { templateId: 31, name: '단어 이어 읽기', trainingType: 'WORD_CHAIN_READING' },
  { templateId: 32, name: '끊어 읽기', trainingType: 'PHRASE_READING' },
  { templateId: 33, name: '한번에 읽기', trainingType: 'REPEATED_SENTENCE_READING' },
  { templateId: 34, name: '짧은 이야기 읽기', trainingType: 'SHORT_STORY_READING' },
]

export const getTrainingTemplateMapping = (
  trainingTemplateId: number,
): LearnerTrainingTemplateMapping | null => (
  resolveTrainingMapping(undefined, trainingTemplateId)
)

export const getGrowthAreaId = (trainingTemplateId: number): 1 | 2 | 3 | null => {
  if (trainingTemplateId >= 1 && trainingTemplateId <= 21) return 1
  if (trainingTemplateId >= 22 && trainingTemplateId <= 29) return 2
  if (trainingTemplateId >= 30 && trainingTemplateId <= 34) return 3
  return null
}
