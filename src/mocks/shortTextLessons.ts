import type { TrainingLesson } from '@/types/training'

export const repeatSentenceLesson: TrainingLesson = {
  id: 'repeat-sentence',
  categoryId: 'short-text',
  title: '한 문장 따라 읽기',
  description: '짧은 문장을 듣고 따라 읽어요.',
  activityType: 'word-reading-grid',
  estimatedMinutes: 8,
  questions: [
    { id: 'q1', instruction: '듣고 따라 읽어봐요.', targetText: '강아지가 공을 굴려요.', phraseChunks: ['강아지가', '공을', '굴려요.'], answer: 'q1', feedback: { correct: '문장을 끝까지 읽었어요!', retry: '천천히 다시 읽어봐요.' } },
    { id: 'q2', instruction: '듣고 따라 읽어봐요.', targetText: '고양이가 창가에 앉아요.', phraseChunks: ['고양이가', '창가에', '앉아요.'], answer: 'q2', feedback: { correct: '또박또박 잘 읽었어요!', retry: '어절마다 천천히 읽어봐요.' } },
    { id: 'q3', instruction: '듣고 따라 읽어봐요.', targetText: '노란 나비가 꽃에 앉아요.', phraseChunks: ['노란 나비가', '꽃에', '앉아요.'], answer: 'q3', feedback: { correct: '문장을 자연스럽게 읽었어요!', retry: '모범 소리를 다시 들어봐요.' } },
    { id: 'q4', instruction: '듣고 따라 읽어봐요.', targetText: '친구와 함께 책을 읽어요.', phraseChunks: ['친구와 함께', '책을', '읽어요.'], answer: 'q4', feedback: { correct: '좋아요! 끝까지 잘 읽었어요.', retry: '짧게 끊어서 읽어봐요.' } },
    { id: 'q5', instruction: '듣고 따라 읽어봐요.', targetText: '비가 그치고 무지개가 떠요.', phraseChunks: ['비가 그치고', '무지개가', '떠요.'], answer: 'q5', feedback: { correct: '훌륭하게 읽었어요!', retry: '한 번 더 차분히 읽어봐요.', completed: '한 문장 따라 읽기를 마쳤어요!' } },
  ],
}

export const fillBlankLesson: TrainingLesson = {
  id: 'fill-blank',
  categoryId: 'short-text',
  title: '빈칸에 알맞은 단어 넣기',
  description: '문장을 읽고 빈칸에 맞는 낱말을 골라요.',
  activityType: 'fill-blank',
  estimatedMinutes: 10,
  questions: [
    { id: 'q1', instruction: '빈칸에 맞는 낱말을 골라봐요.', targetText: '토끼가 ___ 먹어요.', choices: [{ id: 'apple', text: '사과를' }, { id: 'carrot', text: '당근을' }, { id: 'milk', text: '우유를' }], answer: 'carrot', feedback: { correct: '맞아요! 토끼가 당근을 먹어요.', retry: '문장을 다시 읽어봐요.' } },
    { id: 'q2', instruction: '빈칸에 맞는 낱말을 골라봐요.', targetText: '하늘에 ___ 떠요.', choices: [{ id: 'cloud', text: '구름이' }, { id: 'flower', text: '꽃이' }, { id: 'book', text: '책이' }], answer: 'cloud', feedback: { correct: '맞아요! 하늘에 구름이 떠요.', retry: '어디에 무엇이 뜨는지 생각해봐요.' } },
    { id: 'q3', instruction: '빈칸에 맞는 낱말을 골라봐요.', targetText: '아이가 ___ 읽어요.', choices: [{ id: 'book', text: '책을' }, { id: 'ball', text: '공을' }, { id: 'water', text: '물을' }], answer: 'book', feedback: { correct: '잘 찾았어요! 아이가 책을 읽어요.', retry: '읽을 수 있는 것을 골라봐요.' } },
    { id: 'q4', instruction: '빈칸에 맞는 낱말을 골라봐요.', targetText: '꽃에 ___ 앉아요.', choices: [{ id: 'train', text: '기차가' }, { id: 'butterfly', text: '나비가' }, { id: 'chair', text: '의자가' }], answer: 'butterfly', feedback: { correct: '맞아요! 꽃에 나비가 앉아요.', retry: '꽃으로 날아오는 것을 생각해봐요.' } },
    { id: 'q5', instruction: '빈칸에 맞는 낱말을 골라봐요.', targetText: '비가 와서 ___ 써요.', choices: [{ id: 'hat', text: '모자를' }, { id: 'umbrella', text: '우산을' }, { id: 'shoe', text: '신발을' }], answer: 'umbrella', feedback: { correct: '훌륭해요! 비가 와서 우산을 써요.', retry: '비가 올 때 필요한 것을 골라봐요.', completed: '빈칸 단어 넣기를 마쳤어요!' } },
  ],
}

export const hardWordLesson: TrainingLesson = {
  id: 'hard-word',
  categoryId: 'short-text',
  title: '어려운 단어 먼저 읽기',
  description: '긴 낱말을 음절로 나눠 읽어요.',
  activityType: 'word-reading-grid',
  estimatedMinutes: 8,
  questions: [
    { id: 'q1', instruction: '한 칸씩 천천히 읽어봐요.', targetText: '민들레', phraseChunks: ['민', '들', '레'], answer: 'q1', feedback: { correct: '민들레를 끝까지 읽었어요!', retry: '민, 들, 레로 나눠 읽어봐요.' } },
    { id: 'q2', instruction: '한 칸씩 천천히 읽어봐요.', targetText: '도서관', phraseChunks: ['도', '서', '관'], answer: 'q2', feedback: { correct: '도서관을 잘 읽었어요!', retry: '도, 서, 관으로 읽어봐요.' } },
    { id: 'q3', instruction: '한 칸씩 천천히 읽어봐요.', targetText: '잠자리', phraseChunks: ['잠', '자', '리'], answer: 'q3', feedback: { correct: '잠자리를 또박또박 읽었어요!', retry: '한 음절씩 다시 읽어봐요.' } },
    { id: 'q4', instruction: '한 칸씩 천천히 읽어봐요.', targetText: '무지개', phraseChunks: ['무', '지', '개'], answer: 'q4', feedback: { correct: '무지개를 잘 읽었어요!', retry: '무, 지, 개를 차례로 읽어봐요.' } },
    { id: 'q5', instruction: '한 칸씩 천천히 읽어봐요.', targetText: '체육관', phraseChunks: ['체', '육', '관'], answer: 'q5', feedback: { correct: '어려운 낱말도 끝까지 읽었어요!', retry: '세 칸을 하나씩 읽어봐요.', completed: '어려운 단어 읽기를 마쳤어요!' } },
  ],
}

export const sentenceOrderLesson: TrainingLesson = {
  id: 'sentence-order',
  categoryId: 'short-text',
  title: '문장 전체 조립하기',
  description: '어절 카드를 빈칸에 놓아 문장을 만들어요.',
  activityType: 'sentence-order',
  estimatedMinutes: 12,
  questions: [
    { id: 'q1', instruction: '문장을 순서대로 만들어봐요.', targetText: '{studentName}이가 사과를 먹어요.', choices: [{ id: 'eat', text: '먹어요.' }, { id: 'apple', text: '사과를' }, { id: 'yj', text: '{studentName}이가' }], answer: 'yj|apple|eat', feedback: { correct: '맞아요! 문장을 잘 만들었어요.', retry: '누가, 무엇을, 어떻게 했는지 차례로 놓아봐요.' } },
    { id: 'q2', instruction: '문장을 순서대로 만들어봐요.', targetText: '강아지가 빨간 공을 찾아요.', choices: [{ id: 'ball', text: '공을' }, { id: 'find', text: '찾아요.' }, { id: 'dog', text: '강아지가' }, { id: 'red', text: '빨간' }], answer: 'dog|red|ball|find', feedback: { correct: '문장 순서가 맞아요!', retry: '한 번 더 해봐요.' } },
    { id: 'q3', instruction: '문장을 순서대로 만들어봐요.', targetText: '나비가 꽃에 앉아요.', choices: [{ id: 'sit', text: '앉아요.' }, { id: 'butterfly', text: '나비가' }, { id: 'flower', text: '꽃에' }], answer: 'butterfly|flower|sit', feedback: { correct: '잘했어요! 자연스러운 문장이 되었어요.', retry: '나비가 어디에 앉는지 생각해봐요.' } },
    { id: 'q4', instruction: '문장을 순서대로 만들어봐요.', targetText: '친구가 도서관에서 그림책을 읽어요.', choices: [{ id: 'read', text: '읽어요.' }, { id: 'friend', text: '친구가' }, { id: 'book', text: '그림책을' }, { id: 'library', text: '도서관에서' }], answer: 'friend|library|book|read', feedback: { correct: '맞아요! 문장을 잘 완성했어요.', retry: '한 번 더 해봐요.' } },
    { id: 'q5', instruction: '문장을 순서대로 만들어봐요.', targetText: '작은 새가 파란 하늘을 날아요.', choices: [{ id: 'sky', text: '하늘을' }, { id: 'bird', text: '새가' }, { id: 'fly', text: '날아요.' }, { id: 'small', text: '작은' }, { id: 'blue', text: '파란' }], answer: 'small|bird|blue|sky|fly', feedback: { correct: '훌륭해요! 문장 순서가 맞아요.', retry: '한 번 더 해봐요.', completed: '문장 전체 조립하기를 마쳤어요!' } },
  ],
}
