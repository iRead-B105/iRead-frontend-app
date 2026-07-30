import type { TrainingCategoryId } from '@/types/training'

interface LearnerTrainingTemplateMapping {
  readonly categoryId: TrainingCategoryId
  readonly lessonId: string
}

const templateMappings: Readonly<Record<number, LearnerTrainingTemplateMapping>> = {
  1: { categoryId: 'phonics', lessonId: 'trace-vowel' },
  2: { categoryId: 'phonics', lessonId: 'trace-consonant' },
  3: { categoryId: 'phonics', lessonId: 'trace-syllable' },
  4: { categoryId: 'phonics', lessonId: 'letter-sound-choice' },
  5: { categoryId: 'phonics', lessonId: 'letter-sound-choice' },
  6: { categoryId: 'phonological-awareness', lessonId: 'same-sound' },
  7: { categoryId: 'phonological-awareness', lessonId: 'first-sound' },
  8: { categoryId: 'phonological-awareness', lessonId: 'word-first-sound-choice' },
  9: { categoryId: 'phonological-awareness', lessonId: 'same-sound' },
  10: { categoryId: 'phonics', lessonId: 'batchim-sound' },
  11: { categoryId: 'phonological-awareness', lessonId: 'last-sound' },
  12: { categoryId: 'phonics', lessonId: 'batchim-sound' },
  13: { categoryId: 'phonics', lessonId: 'similar-sound' },
  14: { categoryId: 'phonological-awareness', lessonId: 'sound-combine' },
  15: { categoryId: 'phonological-awareness', lessonId: 'sound-combine' },
  16: { categoryId: 'phonics', lessonId: 'build-basic-letter' },
  17: { categoryId: 'phonics', lessonId: 'build-batchim-letter' },
  18: { categoryId: 'phonics', lessonId: 'build-double-batchim-letter' },
  19: { categoryId: 'phonological-awareness', lessonId: 'remove-batchim' },
  20: { categoryId: 'phonological-awareness', lessonId: 'remove-syllable' },
  21: { categoryId: 'phonological-awareness', lessonId: 'replace-syllable' },
  22: { categoryId: 'fluency', lessonId: 'read-real-words' },
  23: { categoryId: 'fluency', lessonId: 'read-nonwords' },
  24: { categoryId: 'short-text', lessonId: 'hard-word' },
  25: { categoryId: 'fluency', lessonId: 'read-sentences' },
  26: { categoryId: 'fluency', lessonId: 'read-short-passage' },
  27: { categoryId: 'short-text', lessonId: 'sentence-order' },
  28: { categoryId: 'short-text', lessonId: 'fill-blank' },
  29: { categoryId: 'short-text', lessonId: 'match-picture' },
  30: { categoryId: 'fluency', lessonId: 'follow-sentence' },
  31: { categoryId: 'fluency', lessonId: 'word-chain' },
  32: { categoryId: 'fluency', lessonId: 'phrase-reading' },
  33: { categoryId: 'fluency', lessonId: 're-read' },
  34: { categoryId: 'fluency', lessonId: 'short-story' },
}

export const getTrainingTemplateMapping = (
  trainingTemplateId: number,
): LearnerTrainingTemplateMapping | null => templateMappings[trainingTemplateId] ?? null

export const getGrowthAreaId = (trainingTemplateId: number): 1 | 2 | 3 | null => {
  if (trainingTemplateId >= 1 && trainingTemplateId <= 21) return 1
  if (trainingTemplateId >= 22 && trainingTemplateId <= 29) return 2
  if (trainingTemplateId >= 30 && trainingTemplateId <= 34) return 3
  return null
}
