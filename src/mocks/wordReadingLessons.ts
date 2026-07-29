import type { TrainingLesson, WordReadingItem } from '@/types/training'

const words = (items: string[]): WordReadingItem[] =>
  items.map((text, index) => ({ id: `word-${index + 1}`, text }))

const question = (id: string, items: string[]) => ({
  id,
  instruction: '왼쪽부터 읽어봐요',
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
    question('real-1', ['나비', '모자', '가위', '토끼']),
    question('real-2', ['사과', '다리', '나무', '기차']),
    question('real-3', ['바다', '우유', '구름', '하늘']),
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
    question('nonword-1', ['머눅', '가핌', '도밴', '비럭']),
    question('nonword-2', ['누밥', '퍼딤', '재몬', '히둑']),
    question('nonword-3', ['버깁', '초뭄', '래둔', '키덜']),
  ],
}
