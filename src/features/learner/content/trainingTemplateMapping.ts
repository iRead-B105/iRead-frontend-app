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
  CONSONANT_VOWEL_CLASSIFICATION: {
    categoryId: 'phonological-awareness',
    lessonId: 'same-sound',
  },
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
  PHONEME_BLEND: { categoryId: 'phonological-awareness', lessonId: 'sound-combine' },
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
  DIFFICULT_WORD_PREVIEW: { categoryId: 'short-text', lessonId: 'hard-word' },
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

const legacyTemplateTypes: Readonly<Record<number, LearnerTrainingType>> = {
  1: 'VOWEL_TRACE',
  2: 'CONSONANT_TRACE',
  3: 'SYLLABLE_TRACE',
  4: 'CONSONANT_SOUND_CHOICE',
  5: 'VOWEL_SOUND_CHOICE',
  6: 'CONSONANT_VOWEL_CLASSIFICATION',
  7: 'SYLLABLE_INITIAL_CHOICE',
  8: 'WORD_INITIAL_CHOICE',
  9: 'SAME_INITIAL_WORD_CHOICE',
  10: 'FINAL_CONSONANT_CHOICE',
  11: 'WORD_FINAL_SOUND_CHOICE',
  12: 'FINAL_CONSONANT_COMPARISON',
  13: 'SIMILAR_SOUND_CHOICE',
  14: 'PHONEME_BLEND',
  15: 'SYLLABLE_BLEND',
  16: 'BASIC_SYLLABLE_BUILD',
  17: 'FINAL_SYLLABLE_BUILD',
  18: 'DOUBLE_FINAL_BUILD',
  19: 'FINAL_CONSONANT_DELETE',
  20: 'SYLLABLE_DELETE',
  21: 'SYLLABLE_REPLACE',
  22: 'WORD_READING',
  23: 'NONWORD_READING',
  24: 'DIFFICULT_WORD_PREVIEW',
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
