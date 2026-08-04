import type { TrainingLesson, WordReadingItem } from '@/types/training'

const words = (items: string[]): WordReadingItem[] =>
  items.map((text, index) => ({ id: `word-${index + 1}`, text }))

const question = (id: string, items: string[]) => ({
  id,
  instruction: '문장을 읽어봐요',
  answer: id,
  readingWords: words(items),
  feedback: {
    correct: '다 읽었어요!',
    retry: '한 번 더 읽어봐요',
  },
})

export const realWordReadingLesson: TrainingLesson = {
  id: 'read-real-words',
  categoryId: 'fluency',
  title: '낱말 읽기',
  description: '네 낱말을 눈으로 보고 소리 내어 읽어요.',
  activityType: 'word-reading-grid',
  estimatedMinutes: 8,
  questions: [
    question('real-1', ['나비']),
    question('real-2', ['사과']),
    question('real-3', ['기차']),
  ],
}

export const batchimWordReadingLesson: TrainingLesson = {
  id: 'read-batchim-words',
  categoryId: 'fluency',
  title: '겹받침 낱말 읽기',
  description: '겹받침이 들어간 낱말을 소리 내어 읽어요.',
  activityType: 'word-reading-grid',
  estimatedMinutes: 8,
  questions: [
    question('batchim-1', ['닭']),
    question('batchim-2', ['흙']),
    question('batchim-3', ['값']),
  ],
}

export const nonwordReadingLesson: TrainingLesson = {
  id: 'read-nonwords',
  categoryId: 'fluency',
  title: '새 낱말 읽기',
  description: '처음 보는 낱말도 소리 내어 읽어요.',
  activityType: 'word-reading-grid',
  estimatedMinutes: 8,
  questions: [
    question('nonword-1', ['머눅']),
    question('nonword-2', ['퍼딤']),
    question('nonword-3', ['히둑']),
  ],
}

export const shortSentenceWordReadingLesson: TrainingLesson = {
  id: 'read-short-sentences',
  categoryId: 'fluency',
  title: '짧은 문장 읽기',
  description: '짧은 문장을 눈으로 보고 소리 내어 읽어요.',
  activityType: 'word-reading-grid',
  estimatedMinutes: 9,
  questions: [
    question('short-sentence-1', ['새가 날아요.']),
    question('short-sentence-2', ['토끼가 뛰어요.']),
    question('short-sentence-3', ['비가 내려요.']),
  ],
}
