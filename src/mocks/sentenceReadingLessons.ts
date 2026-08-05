import type { TrainingLesson } from '@/types/training'

const sentence = (id: string, chunks: string[]) => ({
  id,
  instruction: '문장을 읽어봐요',
  targetText: chunks.join(' '),
  phraseChunks: chunks.flatMap((chunk) => chunk.split(/\s+/).filter(Boolean)),
  readingGranularity: 'word' as const,
  answer: id,
  feedback: {
    correct: '다 읽었어요!',
    retry: '한 번 더 읽어봐요',
  },
})

export const sentenceReadingLesson: TrainingLesson = {
  id: 'read-sentences',
  categoryId: 'fluency',
  title: '문장 읽기',
  description: '한 문장을 왼쪽부터 또박또박 읽어요.',
  activityType: 'word-reading-grid',
  estimatedMinutes: 9,
  questions: [
    sentence('sentence-1', ['토끼가', '풀밭을', '달려요.']),
    sentence('sentence-2', ['노란', '나비가', '꽃에', '앉아요.']),
    sentence('sentence-3', ['민수는', '작은', '공을', '잡아요.']),
    sentence('sentence-4', ['따뜻한', '햇빛이', '창문으로', '들어와요.']),
  ],
}
