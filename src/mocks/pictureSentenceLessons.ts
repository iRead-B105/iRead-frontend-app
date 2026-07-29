import type { TrainingLesson } from '@/types/training'
import rabbitCarrotImage from '@/assets/sentence-match/rabbit-carrot.png'
import butterflyFlowerImage from '@/assets/sentence-match/butterfly-flower.png'
import childReadingImage from '@/assets/sentence-match/child-reading.png'

export const pictureSentenceLesson: TrainingLesson = {
  id: 'match-picture',
  categoryId: 'short-text',
  title: '그림과 문장 연결하기',
  description: '그림에 맞는 문장을 찾아 연결해요.',
  activityType: 'sentence-choice',
  estimatedMinutes: 10,
  questions: [
    {
      id: 'picture-rabbit',
      instruction: '그림에 맞는 문장을 연결해봐요.',
      targetImage: rabbitCarrotImage,
      targetImageLabel: '토끼가 당근을 먹는 그림',
      targetText: '토끼가 당근을 먹어요.',
      choices: [
        { id: 'rabbit-sleep', text: '토끼가 풀밭에서 자요.' },
        { id: 'rabbit-eat', text: '토끼가 당근을 먹어요.' },
        { id: 'rabbit-ball', text: '토끼가 공을 굴려요.' },
      ],
      answer: 'rabbit-eat',
      feedback: { correct: '잘 찾았어요!', retry: '한 번 더 해봐요' },
    },
    {
      id: 'picture-butterfly',
      instruction: '그림에 맞는 문장을 연결해봐요.',
      targetImage: butterflyFlowerImage,
      targetImageLabel: '노란 나비가 분홍 꽃에 앉은 그림',
      targetText: '노란 나비가 꽃에 앉아요.',
      choices: [
        { id: 'butterfly-fly', text: '노란 나비가 하늘을 날아요.' },
        { id: 'bee-flower', text: '작은 벌이 꽃을 찾아와요.' },
        { id: 'butterfly-sit', text: '노란 나비가 꽃에 앉아요.' },
      ],
      answer: 'butterfly-sit',
      feedback: { correct: '잘 찾았어요!', retry: '한 번 더 해봐요' },
    },
    {
      id: 'picture-reading',
      instruction: '그림에 맞는 문장을 연결해봐요.',
      targetImage: childReadingImage,
      targetImageLabel: '아이가 책상에서 그림책을 읽는 그림',
      targetText: '아이가 그림책을 읽어요.',
      choices: [
        { id: 'child-write', text: '아이가 공책에 글씨를 써요.' },
        { id: 'child-read', text: '아이가 그림책을 읽어요.' },
        { id: 'child-draw', text: '아이가 종이에 그림을 그려요.' },
      ],
      answer: 'child-read',
      feedback: { correct: '잘 찾았어요!', retry: '한 번 더 해봐요', completed: '그림과 문장 연결하기를 마쳤어요!' },
    },
  ],
}
