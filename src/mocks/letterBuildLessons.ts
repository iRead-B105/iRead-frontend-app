import type { LetterBuildSlot, TrainingChoice, TrainingLesson } from '@/types/training'

const card = (id: string, text: string): TrainingChoice => ({ id, text })
const slot = (
  id: string,
  role: LetterBuildSlot['role'],
  answerChoiceId: string,
  hintText: string,
): LetterBuildSlot => ({ id, role, answerChoiceId, hintText })

const feedback = {
  correct: '잘 만들었어!',
  retry: '카드를 다시 놓아봐요.',
}

export const basicLetterBuildLesson: TrainingLesson = {
  id: 'build-basic-letter',
  categoryId: 'phonics',
  title: '기본 글자 만들기',
  description: '소리를 듣고 초성과 중성을 모아요.',
  activityType: 'letter-build',
  estimatedMinutes: 10,
  questions: [
    { id: 'build-ga', instruction: '소리를 듣고 만들어요.', audioText: '가', combined: '가', answer: '가', buildSlots: [slot('initial', 'initial', 'g', 'ㄱ'), slot('medial', 'medial', 'a', 'ㅏ')], choices: [card('g', 'ㄱ'), card('n', 'ㄴ'), card('a', 'ㅏ'), card('eo', 'ㅓ')], feedback },
    { id: 'build-neo', instruction: '소리를 듣고 만들어요.', audioText: '너', combined: '너', answer: '너', buildSlots: [slot('initial', 'initial', 'n', 'ㄴ'), slot('medial', 'medial', 'eo', 'ㅓ')], choices: [card('eo', 'ㅓ'), card('d', 'ㄷ'), card('n', 'ㄴ'), card('o', 'ㅗ')], feedback },
    { id: 'build-mo', instruction: '소리를 듣고 만들어요.', audioText: '모', combined: '모', answer: '모', buildSlots: [slot('initial', 'initial', 'm', 'ㅁ'), slot('medial', 'medial', 'o', 'ㅗ')], choices: [card('b', 'ㅂ'), card('o', 'ㅗ'), card('u', 'ㅜ'), card('m', 'ㅁ')], feedback },
  ],
}

export const batchimLetterBuildLesson: TrainingLesson = {
  id: 'build-batchim-letter',
  categoryId: 'phonics',
  title: '받침 글자 만들기',
  description: '소리를 듣고 받침까지 모아요.',
  activityType: 'letter-build',
  estimatedMinutes: 10,
  questions: [
    { id: 'build-gam', instruction: '소리를 듣고 만들어요.', audioText: '감', combined: '감', answer: '감', buildSlots: [slot('initial', 'initial', 'g', 'ㄱ'), slot('medial', 'medial', 'a', 'ㅏ'), slot('final', 'final', 'm', 'ㅁ')], choices: [card('m', 'ㅁ'), card('a', 'ㅏ'), card('n', 'ㄴ'), card('g', 'ㄱ')], feedback },
    { id: 'build-mun', instruction: '소리를 듣고 만들어요.', audioText: '문', combined: '문', answer: '문', buildSlots: [slot('initial', 'initial', 'm', 'ㅁ'), slot('medial', 'medial', 'u', 'ㅜ'), slot('final', 'final', 'n', 'ㄴ')], choices: [card('b', 'ㅂ'), card('n', 'ㄴ'), card('m', 'ㅁ'), card('u', 'ㅜ')], feedback },
    { id: 'build-dal', instruction: '소리를 듣고 만들어요.', audioText: '달', combined: '달', answer: '달', buildSlots: [slot('initial', 'initial', 'd', 'ㄷ'), slot('medial', 'medial', 'a', 'ㅏ'), slot('final', 'final', 'r', 'ㄹ')], choices: [card('a', 'ㅏ'), card('r', 'ㄹ'), card('m', 'ㅁ'), card('d', 'ㄷ')], feedback },
    { id: 'build-guk', instruction: '소리를 듣고 만들어요.', audioText: '국', combined: '국', answer: '국', buildSlots: [slot('initial', 'initial', 'g', 'ㄱ'), slot('medial', 'medial', 'u', 'ㅜ'), slot('final', 'final', 'final-g', 'ㄱ')], choices: [card('g', 'ㄱ'), card('u', 'ㅜ'), card('final-g', 'ㄱ'), card('n', 'ㄴ')], feedback },
    { id: 'build-gwa', instruction: '소리를 듣고 만들어요.', audioText: '과', combined: '과', answer: '과', buildSlots: [slot('initial', 'initial', 'g', 'ㄱ'), slot('medial', 'medial', 'wa', 'ㅘ')], choices: [card('g', 'ㄱ'), card('wa', 'ㅘ'), card('n', 'ㄴ'), card('eo', 'ㅓ')], feedback },
  ],
}

export const doubleBatchimLetterBuildLesson: TrainingLesson = {
  id: 'build-double-batchim-letter',
  categoryId: 'phonics',
  title: '겹받침 글자 만들기',
  description: '소리를 듣고 겹받침까지 모아요.',
  activityType: 'letter-build',
  estimatedMinutes: 12,
  questions: [
    { id: 'build-dak', instruction: '소리를 듣고 만들어요.', audioText: '닭', combined: '닭', answer: '닭', buildSlots: [slot('initial', 'initial', 'd', 'ㄷ'), slot('medial', 'medial', 'a', 'ㅏ'), slot('final', 'final', 'rg', 'ㄺ')], choices: [card('g', 'ㄱ'), card('rg', 'ㄺ'), card('a', 'ㅏ'), card('d', 'ㄷ')], feedback },
    { id: 'build-sam', instruction: '소리를 듣고 만들어요.', audioText: '삶', combined: '삶', answer: '삶', buildSlots: [slot('initial', 'initial', 's', 'ㅅ'), slot('medial', 'medial', 'a', 'ㅏ'), slot('final', 'final', 'rm', 'ㄻ')], choices: [card('rm', 'ㄻ'), card('r', 'ㄹ'), card('s', 'ㅅ'), card('a', 'ㅏ')], feedback },
    { id: 'build-gap', instruction: '소리를 듣고 만들어요.', audioText: '값', combined: '값', answer: '값', buildSlots: [slot('initial', 'initial', 'g', 'ㄱ'), slot('medial', 'medial', 'a', 'ㅏ'), slot('final', 'final', 'bs', 'ㅄ')], choices: [card('b', 'ㅂ'), card('g', 'ㄱ'), card('bs', 'ㅄ'), card('a', 'ㅏ')], feedback },
  ],
}
