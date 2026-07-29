import type { TrainingLesson } from '@/types/training'

const consonant = (id: string, jamo: string) => ({
  id,
  letter: { jamo, type: 'consonant' as const },
})

const vowel = (id: string, jamo: string) => ({
  id,
  letter: { jamo, type: 'vowel' as const },
})

const feedback = {
  correct: '맞았어!',
  retry: '한 번 더 들어봐요.',
}

export const letterSoundChoiceLesson: TrainingLesson = {
  id: 'letter-sound-choice',
  categoryId: 'phonics',
  title: '글자 소리 고르기',
  description: '소리를 듣고 같은 글자를 골라요.',
  activityType: 'audio-letter-choice',
  estimatedMinutes: 8,
  questions: [
    { id: 'letter-g', instruction: '들은 소리를 골라요.', audioText: 'ㄱ', choices: [consonant('g', 'ㄱ'), consonant('n', 'ㄴ'), consonant('m', 'ㅁ')], answer: 'g', feedback },
    { id: 'letter-a', instruction: '들은 소리를 골라요.', audioText: 'ㅏ', choices: [vowel('eo', 'ㅓ'), vowel('a', 'ㅏ'), vowel('o', 'ㅗ')], answer: 'a', feedback },
    { id: 'letter-n', instruction: '들은 소리를 골라요.', audioText: 'ㄴ', choices: [consonant('d', 'ㄷ'), consonant('r', 'ㄹ'), consonant('n', 'ㄴ')], answer: 'n', feedback },
    { id: 'letter-eo', instruction: '들은 소리를 골라요.', audioText: 'ㅓ', choices: [vowel('eo', 'ㅓ'), vowel('u', 'ㅜ'), vowel('eu', 'ㅡ')], answer: 'eo', feedback },
    { id: 'letter-m', instruction: '들은 소리를 골라요.', audioText: 'ㅁ', choices: [consonant('b', 'ㅂ'), consonant('m', 'ㅁ'), consonant('s', 'ㅅ')], answer: 'm', feedback },
    { id: 'letter-o', instruction: '들은 소리를 골라요.', audioText: 'ㅗ', choices: [vowel('u', 'ㅜ'), vowel('eu', 'ㅡ'), vowel('o', 'ㅗ')], answer: 'o', feedback },
  ],
}

export const wordFirstSoundChoiceLesson: TrainingLesson = {
  id: 'word-first-sound-choice',
  categoryId: 'phonological-awareness',
  title: '낱말 첫소리 고르기',
  description: '낱말을 듣고 첫소리 글자를 골라요.',
  activityType: 'audio-letter-choice',
  estimatedMinutes: 8,
  questions: [
    { id: 'word-bag', instruction: '첫소리를 골라요.', audioText: '가방', choices: [consonant('g', 'ㄱ'), consonant('n', 'ㄴ'), consonant('m', 'ㅁ')], answer: 'g', feedback },
    { id: 'word-butterfly', instruction: '첫소리를 골라요.', audioText: '나비', choices: [consonant('d', 'ㄷ'), consonant('n', 'ㄴ'), consonant('s', 'ㅅ')], answer: 'n', feedback },
    { id: 'word-hat', instruction: '첫소리를 골라요.', audioText: '모자', choices: [consonant('m', 'ㅁ'), consonant('b', 'ㅂ'), consonant('j', 'ㅈ')], answer: 'm', feedback },
    { id: 'word-bridge', instruction: '첫소리를 골라요.', audioText: '다리', choices: [consonant('t', 'ㅌ'), consonant('r', 'ㄹ'), consonant('d', 'ㄷ')], answer: 'd', feedback },
    { id: 'word-apple', instruction: '첫소리를 골라요.', audioText: '사과', choices: [consonant('j', 'ㅈ'), consonant('s', 'ㅅ'), consonant('h', 'ㅎ')], answer: 's', feedback },
  ],
}
