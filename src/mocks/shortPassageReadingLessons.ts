import type { ReadingSentence, TrainingLesson } from '@/types/training'

const row = (id: string, chunks: string[]): ReadingSentence => ({ id, chunks })

const passage = (id: string, readingSentences: ReadingSentence[]) => ({
  id,
  instruction: '글을 읽어봐요',
  readingSentences,
  answer: id,
  feedback: {
    correct: '다 읽었어요!',
    retry: '한 번 더 읽어봐요',
  },
})

export const shortPassageReadingLesson: TrainingLesson = {
  id: 'read-short-passage',
  categoryId: 'fluency',
  title: '짧은 글 읽기',
  description: '문장을 차례대로 이어 읽어요.',
  activityType: 'word-reading-grid',
  estimatedMinutes: 10,
  questions: [
    passage('passage-1', [
      row('line-1', ['토끼가', '풀밭을', '달려요.']),
      row('line-2', ['친구들이', '함께', '웃어요.']),
    ]),
    passage('passage-2', [
      row('line-1', ['노란', '나비가', '날아와요.']),
      row('line-2', ['예쁜', '꽃에', '앉아요.']),
      row('line-3', ['날개를', '살랑살랑', '움직여요.']),
    ]),
    passage('passage-3', [
      row('line-1', ['비가', '그치고', '해가', '났어요.']),
      row('line-2', ['하늘에', '무지개가', '떴어요.']),
    ]),
  ],
}
