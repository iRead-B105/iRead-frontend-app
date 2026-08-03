import type { TrainingLesson } from '@/types/training'

export const wordChainLesson: TrainingLesson = {
  id: 'word-chain',
  categoryId: 'fluency',
  title: '단어 이어 읽기',
  description: '낱말을 멈추지 않고 차례로 읽어요.',
  activityType: 'word-reading-grid',
  estimatedMinutes: 8,
  questions: [
    { id: 'q1', instruction: '단어를 차례로 읽어봐요.', targetText: '사과 나비 기차', phraseChunks: ['사과', '나비', '기차'], answer: 'q1', feedback: { correct: '세 단어를 잘 이어 읽었어요!', retry: '단어마다 천천히 이어봐요.' } },
    { id: 'q2', instruction: '단어를 차례로 읽어봐요.', targetText: '모자 다리 토끼', phraseChunks: ['모자', '다리', '토끼'], answer: 'q2', feedback: { correct: '좋아요! 자연스럽게 이어 읽었어요.', retry: '모범 소리를 다시 들어봐요.' } },
    { id: 'q3', instruction: '단어를 차례로 읽어봐요.', targetText: '하늘 구름 바람', phraseChunks: ['하늘', '구름', '바람'], answer: 'q3', feedback: { correct: '리듬을 잘 살려 읽었어요!', retry: '세 단어를 같은 속도로 읽어봐요.' } },
    { id: 'q4', instruction: '단어를 차례로 읽어봐요.', targetText: '학교 교실 친구', phraseChunks: ['학교', '교실', '친구'], answer: 'q4', feedback: { correct: '또박또박 잘 이어 읽었어요!', retry: '낱말 사이를 짧게 쉬어봐요.' } },
    { id: 'q5', instruction: '단어를 차례로 읽어봐요.', targetText: '아침 점심 저녁', phraseChunks: ['아침', '점심', '저녁'], answer: 'q5', feedback: { correct: '훌륭하게 이어 읽었어요!', retry: '처음부터 한 번 더 읽어봐요.', completed: '단어 이어 읽기를 마쳤어요!' } },
  ],
}

export const phraseReadingLesson: TrainingLesson = {
  id: 'phrase-reading',
  categoryId: 'fluency',
  title: '끊어 읽기',
  description: '뜻이 이어지는 말끼리 묶어 읽어요.',
  activityType: 'word-reading-grid',
  estimatedMinutes: 10,
  questions: [
    { id: 'q1', instruction: '묶음마다 잠깐 쉬어 읽어봐요.', targetText: '작은 새가 하늘을 날아요.', phraseChunks: ['작은 새가', '하늘을', '날아요.'], answer: 'q1', feedback: { correct: '뜻에 맞게 잘 끊어 읽었어요!', retry: '보이는 묶음마다 잠깐 쉬어봐요.' } },
    { id: 'q2', instruction: '묶음마다 잠깐 쉬어 읽어봐요.', targetText: '{studentName}이는 도서관에서 책을 읽어요.', phraseChunks: ['{studentName}이는', '도서관에서', '책을 읽어요.'], answer: 'q2', feedback: { correct: '문장 뜻이 잘 들리게 읽었어요!', retry: '세 묶음으로 나눠 읽어봐요.' } },
    { id: 'q3', instruction: '묶음마다 잠깐 쉬어 읽어봐요.', targetText: '비가 그치면 무지개가 떠요.', phraseChunks: ['비가 그치면', '무지개가', '떠요.'], answer: 'q3', feedback: { correct: '자연스럽게 끊어 읽었어요!', retry: '모범 소리의 쉬는 곳을 들어봐요.' } },
    { id: 'q4', instruction: '묶음마다 잠깐 쉬어 읽어봐요.', targetText: '따뜻한 햇살이 창문으로 들어와요.', phraseChunks: ['따뜻한 햇살이', '창문으로', '들어와요.'], answer: 'q4', feedback: { correct: '긴 문장도 편안하게 읽었어요!', retry: '한 묶음씩 차분히 읽어봐요.' } },
    { id: 'q5', instruction: '묶음마다 잠깐 쉬어 읽어봐요.', targetText: '친구와 손을 잡고 공원으로 걸어가요.', phraseChunks: ['친구와 손을 잡고', '공원으로', '걸어가요.'], answer: 'q5', feedback: { correct: '훌륭하게 끊어 읽었어요!', retry: '뜻이 이어지는 말끼리 읽어봐요.', completed: '끊어 읽기를 마쳤어요!' } },
  ],
}

export const reReadLesson: TrainingLesson = {
  id: 're-read',
  categoryId: 'fluency',
  title: '같은 문장 다시 읽기',
  description: '같은 문장을 반복해 편안하게 읽어요.',
  activityType: 'word-reading-grid',
  estimatedMinutes: 8,
  questions: [
    { id: 'q1', instruction: '첫 번째로 읽어봐요.', targetText: '토끼가 풀밭을 달려요.', phraseChunks: ['토끼가', '풀밭을', '달려요.'], answer: 'q1', feedback: { correct: '첫 번째 읽기를 마쳤어요!', retry: '천천히 시작해봐요.' } },
    { id: 'q2', instruction: '같은 문장을 다시 읽어봐요.', targetText: '토끼가 풀밭을 달려요.', phraseChunks: ['토끼가', '풀밭을', '달려요.'], answer: 'q2', feedback: { correct: '두 번째는 더 편안하게 읽었어요!', retry: '익숙한 문장을 다시 이어봐요.' } },
    { id: 'q3', instruction: '한 번 더 읽어봐요.', targetText: '토끼가 풀밭을 달려요.', phraseChunks: ['토끼가', '풀밭을', '달려요.'], answer: 'q3', feedback: { correct: '세 번째까지 자연스럽게 읽었어요!', retry: '문장 리듬을 떠올려봐요.' } },
    { id: 'q4', instruction: '새 문장을 읽어봐요.', targetText: '바람이 나뭇잎을 흔들어요.', phraseChunks: ['바람이', '나뭇잎을', '흔들어요.'], answer: 'q4', feedback: { correct: '새 문장도 잘 읽었어요!', retry: '모범 소리를 듣고 시작해봐요.' } },
    { id: 'q5', instruction: '같은 문장을 다시 읽어봐요.', targetText: '바람이 나뭇잎을 흔들어요.', phraseChunks: ['바람이', '나뭇잎을', '흔들어요.'], answer: 'q5', feedback: { correct: '반복해서 더 자연스럽게 읽었어요!', retry: '한 묶음씩 이어 읽어봐요.', completed: '같은 문장 다시 읽기를 마쳤어요!' } },
  ],
}

export const shortStoryLesson: TrainingLesson = {
  id: 'short-story',
  categoryId: 'fluency',
  title: '짧은 이야기 읽기',
  description: '두 문장을 이어 짧은 이야기를 읽어요.',
  activityType: 'word-reading-grid',
  estimatedMinutes: 12,
  questions: [
    { id: 'q1', instruction: '두 문장을 이어 읽어봐요.', targetText: '봄이 왔어요. 따뜻한 햇살이 비쳐요.', phraseChunks: ['봄이 왔어요.', '따뜻한 햇살이 비쳐요.'], answer: 'q1', feedback: { correct: '봄 이야기를 잘 읽었어요!', retry: '한 문장씩 이어 읽어봐요.' } },
    { id: 'q2', instruction: '두 문장을 이어 읽어봐요.', targetText: '민수는 씨앗을 심었어요. 작은 싹이 돋았어요.', phraseChunks: ['민수는 씨앗을 심었어요.', '작은 싹이 돋았어요.'], answer: 'q2', feedback: { correct: '이야기의 흐름이 잘 들렸어요!', retry: '마침표에서 잠깐 쉬어봐요.' } },
    { id: 'q3', instruction: '두 문장을 이어 읽어봐요.', targetText: '구름이 모였어요. 곧 비가 내리기 시작했어요.', phraseChunks: ['구름이 모였어요.', '곧 비가 내리기 시작했어요.'], answer: 'q3', feedback: { correct: '두 문장을 자연스럽게 이었어요!', retry: '첫 문장 뒤에 잠깐 쉬어봐요.' } },
    { id: 'q4', instruction: '두 문장을 이어 읽어봐요.', targetText: '{studentName}이는 우산을 폈어요. 친구와 함께 걸어갔어요.', phraseChunks: ['{studentName}이는 우산을 폈어요.', '친구와 함께 걸어갔어요.'], answer: 'q4', feedback: { correct: '긴 이야기도 또박또박 읽었어요!', retry: '한 문장씩 차분히 읽어봐요.' } },
    { id: 'q5', instruction: '두 문장을 이어 읽어봐요.', targetText: '비가 그쳤어요. 하늘에 무지개가 떴어요.', phraseChunks: ['비가 그쳤어요.', '하늘에 무지개가 떴어요.'], answer: 'q5', feedback: { correct: '짧은 이야기를 끝까지 읽었어요!', retry: '마침표를 보고 쉬어 읽어봐요.', completed: '짧은 이야기 읽기를 마쳤어요!' } },
  ],
}
