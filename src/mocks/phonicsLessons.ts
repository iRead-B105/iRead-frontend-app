import type { TrainingLesson } from '@/types/training'

const consonant = (id: string, jamo: string) => ({ id, letter: { jamo, type: 'consonant' as const } })
const vowel = (id: string, jamo: string) => ({ id, letter: { jamo, type: 'vowel' as const } })

export const consonantSoundLesson: TrainingLesson = {
  id: 'consonant-sound',
  categoryId: 'phonics',
  title: '자음 소리 익히기',
  description: '소리를 듣고 알맞은 자음을 골라요.',
  activityType: 'sound-choice',
  estimatedMinutes: 10,
  questions: [
    { id: 'q1', instruction: '들은 소리를 골라봐요.', audioText: '그', choices: [consonant('g', 'ㄱ'), consonant('n', 'ㄴ'), consonant('d', 'ㄷ')], answer: 'g', feedback: { correct: '맞아요! ㄱ 소리예요.', retry: '소리를 다시 들어봐요.' } },
    { id: 'q2', instruction: '들은 소리를 골라봐요.', audioText: '느', choices: [consonant('d', 'ㄷ'), consonant('n', 'ㄴ'), consonant('m', 'ㅁ')], answer: 'n', feedback: { correct: '잘 들었어요! ㄴ 소리예요.', retry: '한 번 더 천천히 들어봐요.' } },
    { id: 'q3', instruction: '들은 소리를 골라봐요.', audioText: '드', choices: [consonant('t', 'ㅌ'), consonant('d', 'ㄷ'), consonant('r', 'ㄹ')], answer: 'd', feedback: { correct: '맞아요! ㄷ 소리예요.', retry: '소리를 다시 비교해봐요.' } },
    { id: 'q4', instruction: '들은 소리를 골라봐요.', audioText: '므', choices: [consonant('m', 'ㅁ'), consonant('b', 'ㅂ'), consonant('n', 'ㄴ')], answer: 'm', feedback: { correct: '잘 찾았어요! ㅁ 소리예요.', retry: '입을 다물고 나는 소리를 들어봐요.' } },
    { id: 'q5', instruction: '들은 소리를 골라봐요.', audioText: '스', choices: [consonant('j', 'ㅈ'), consonant('s', 'ㅅ'), consonant('h', 'ㅎ')], answer: 's', feedback: { correct: '훌륭해요! ㅅ 소리예요.', retry: '소리를 다시 들어봐요.', completed: '자음 소리 익히기를 마쳤어요!' } },
  ],
}

export const vowelSoundLesson: TrainingLesson = {
  id: 'vowel-sound',
  categoryId: 'phonics',
  title: '모음 소리 익히기',
  description: '소리를 듣고 알맞은 모음을 골라요.',
  activityType: 'sound-choice',
  estimatedMinutes: 10,
  questions: [
    { id: 'q1', instruction: '들은 소리를 골라봐요.', audioText: '아', choices: [vowel('a', 'ㅏ'), vowel('eo', 'ㅓ'), vowel('o', 'ㅗ')], answer: 'a', feedback: { correct: '맞아요! ㅏ 소리예요.', retry: '소리를 다시 들어봐요.' } },
    { id: 'q2', instruction: '들은 소리를 골라봐요.', audioText: '어', choices: [vowel('o', 'ㅗ'), vowel('eo', 'ㅓ'), vowel('u', 'ㅜ')], answer: 'eo', feedback: { correct: '잘 들었어요! ㅓ 소리예요.', retry: '입 모양을 떠올리며 들어봐요.' } },
    { id: 'q3', instruction: '들은 소리를 골라봐요.', audioText: '오', choices: [vowel('o', 'ㅗ'), vowel('u', 'ㅜ'), vowel('eu', 'ㅡ')], answer: 'o', feedback: { correct: '맞아요! ㅗ 소리예요.', retry: '둥근 입 모양의 소리를 다시 들어봐요.' } },
    { id: 'q4', instruction: '들은 소리를 골라봐요.', audioText: '우', choices: [vowel('eu', 'ㅡ'), vowel('u', 'ㅜ'), vowel('i', 'ㅣ')], answer: 'u', feedback: { correct: '잘 찾았어요! ㅜ 소리예요.', retry: '한 번 더 들어봐요.' } },
    { id: 'q5', instruction: '들은 소리를 골라봐요.', audioText: '이', choices: [vowel('a', 'ㅏ'), vowel('i', 'ㅣ'), vowel('eo', 'ㅓ')], answer: 'i', feedback: { correct: '훌륭해요! ㅣ 소리예요.', retry: '소리를 다시 비교해봐요.', completed: '모음 소리 익히기를 마쳤어요!' } },
  ],
}

export const batchimSoundLesson: TrainingLesson = {
  id: 'batchim-sound',
  categoryId: 'phonics',
  title: '받침 소리 익히기',
  description: '낱말의 받침 소리를 찾아요.',
  activityType: 'listen-and-select',
  estimatedMinutes: 10,
  questions: [
    { id: 'q1', instruction: '받침 소리를 찾아봐요.', subInstruction: "'문'의 받침은 무엇일까요?", targetText: '문', choices: [consonant('n', 'ㄴ'), consonant('m', 'ㅁ'), consonant('r', 'ㄹ')], answer: 'n', feedback: { correct: '맞아요! 문의 받침은 ㄴ이에요.', retry: '끝소리를 다시 들어봐요.' } },
    { id: 'q2', instruction: '받침 소리를 찾아봐요.', subInstruction: "'밤'의 받침은 무엇일까요?", targetText: '밤', choices: [consonant('r', 'ㄹ'), consonant('m', 'ㅁ'), consonant('b', 'ㅂ')], answer: 'm', feedback: { correct: '잘 찾았어요! 밤의 받침은 ㅁ이에요.', retry: '낱말 끝을 다시 들어봐요.' } },
    { id: 'q3', instruction: '받침 소리를 찾아봐요.', subInstruction: "'달'의 받침은 무엇일까요?", targetText: '달', choices: [consonant('n', 'ㄴ'), consonant('r', 'ㄹ'), consonant('g', 'ㄱ')], answer: 'r', feedback: { correct: '맞아요! 달의 받침은 ㄹ이에요.', retry: '마지막 소리에 귀 기울여봐요.' } },
    { id: 'q4', instruction: '받침 소리를 찾아봐요.', subInstruction: "'책'의 받침은 무엇일까요?", targetText: '책', choices: [consonant('g', 'ㄱ'), consonant('s', 'ㅅ'), consonant('m', 'ㅁ')], answer: 'g', feedback: { correct: '잘 들었어요! 책의 받침은 ㄱ이에요.', retry: '책의 끝소리를 다시 들어봐요.' } },
    { id: 'q5', instruction: '받침 소리를 찾아봐요.', subInstruction: "'밥'의 받침은 무엇일까요?", targetText: '밥', choices: [consonant('m', 'ㅁ'), consonant('b', 'ㅂ'), consonant('n', 'ㄴ')], answer: 'b', feedback: { correct: '훌륭해요! 밥의 받침은 ㅂ이에요.', retry: '끝소리를 다시 들어봐요.', completed: '받침 소리 익히기를 마쳤어요!' } },
  ],
}

export const similarSoundLesson: TrainingLesson = {
  id: 'similar-sound',
  categoryId: 'phonics',
  title: '비슷한 소리 구별하기',
  description: '비슷하게 들리는 자음 소리를 구별해요.',
  activityType: 'sound-choice',
  estimatedMinutes: 12,
  questions: [
    { id: 'q1', instruction: '들은 첫소리를 골라봐요.', audioText: '가', choices: [consonant('g', 'ㄱ'), consonant('k', 'ㅋ'), consonant('d', 'ㄷ')], answer: 'g', feedback: { correct: '맞아요! 가는 ㄱ으로 시작해요.', retry: '가와 카의 차이를 다시 들어봐요.' } },
    { id: 'q2', instruction: '들은 첫소리를 골라봐요.', audioText: '카', choices: [consonant('g', 'ㄱ'), consonant('k', 'ㅋ'), consonant('t', 'ㅌ')], answer: 'k', feedback: { correct: '잘 들었어요! 카는 ㅋ으로 시작해요.', retry: '세게 터지는 첫소리를 들어봐요.' } },
    { id: 'q3', instruction: '들은 첫소리를 골라봐요.', audioText: '다', choices: [consonant('d', 'ㄷ'), consonant('t', 'ㅌ'), consonant('g', 'ㄱ')], answer: 'd', feedback: { correct: '맞아요! 다는 ㄷ으로 시작해요.', retry: '다와 타를 다시 비교해봐요.' } },
    { id: 'q4', instruction: '들은 첫소리를 골라봐요.', audioText: '타', choices: [consonant('d', 'ㄷ'), consonant('t', 'ㅌ'), consonant('k', 'ㅋ')], answer: 't', feedback: { correct: '잘 찾았어요! 타는 ㅌ으로 시작해요.', retry: '첫소리를 다시 들어봐요.' } },
    { id: 'q5', instruction: '들은 첫소리를 골라봐요.', audioText: '파', choices: [consonant('b', 'ㅂ'), consonant('p', 'ㅍ'), consonant('m', 'ㅁ')], answer: 'p', feedback: { correct: '훌륭해요! 파는 ㅍ으로 시작해요.', retry: '바와 파의 차이를 다시 들어봐요.', completed: '비슷한 소리 구별하기를 마쳤어요!' } },
  ],
}
