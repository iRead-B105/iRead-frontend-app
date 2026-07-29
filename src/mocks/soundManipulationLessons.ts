import type { SoundManipulationUnit, TrainingChoice, TrainingLesson } from '@/types/training'

const unit = (id: string, text: string): SoundManipulationUnit => ({ id, text })
const choice = (id: string, text: string): TrainingChoice => ({ id, text })
const feedback = { correct: '잘했어!', retry: '소리를 다시 눌러봐요.' }

export const removeBatchimLesson: TrainingLesson = {
  id: 'remove-batchim',
  categoryId: 'phonological-awareness',
  title: '받침 빼기',
  description: '받침 소리를 빼서 새 글자를 만들어요.',
  activityType: 'sound-manipulation',
  estimatedMinutes: 10,
  questions: [
    { id: 'dak-to-da', instruction: '소리를 빼서 만들어요.', audioText: '닭에서 다를 만들어요.', targetText: '닭', targetResult: '다', manipulationMode: 'remove', manipulationUnits: [unit('d', 'ㄷ'), unit('a', 'ㅏ'), unit('r', 'ㄹ'), unit('g', 'ㄱ')], manipulationTargetUnitIds: ['r', 'g'], answer: 'r|g', feedback },
    { id: 'gam-to-ga', instruction: '소리를 빼서 만들어요.', audioText: '감에서 가를 만들어요.', targetText: '감', targetResult: '가', manipulationMode: 'remove', manipulationUnits: [unit('g', 'ㄱ'), unit('a', 'ㅏ'), unit('m', 'ㅁ')], manipulationTargetUnitIds: ['m'], answer: 'm', feedback },
    { id: 'gap-to-ga', instruction: '소리를 빼서 만들어요.', audioText: '값에서 가를 만들어요.', targetText: '값', targetResult: '가', manipulationMode: 'remove', manipulationUnits: [unit('g', 'ㄱ'), unit('a', 'ㅏ'), unit('b', 'ㅂ'), unit('s', 'ㅅ')], manipulationTargetUnitIds: ['b', 's'], answer: 'b|s', feedback },
  ],
}

export const removeSyllableLesson: TrainingLesson = {
  id: 'remove-syllable',
  categoryId: 'phonological-awareness',
  title: '음절 빼기',
  description: '낱말에서 소리 하나를 빼요.',
  activityType: 'sound-manipulation',
  estimatedMinutes: 10,
  questions: [
    { id: 'banana-to-bana', instruction: '소리 하나를 빼요.', audioText: '바나나에서 바나를 만들어요.', targetText: '바나나', targetResult: '바나', manipulationMode: 'remove', manipulationUnits: [unit('ba', '바'), unit('na1', '나'), unit('na2', '나')], manipulationTargetUnitIds: ['na2'], manipulationAnswerSets: [['na1'], ['na2']], answer: 'na2', feedback },
    { id: 'goguma-to-gogu', instruction: '소리 하나를 빼요.', audioText: '고구마에서 고구를 만들어요.', targetText: '고구마', targetResult: '고구', manipulationMode: 'remove', manipulationUnits: [unit('go', '고'), unit('gu', '구'), unit('ma', '마')], manipulationTargetUnitIds: ['ma'], answer: 'ma', feedback },
    { id: 'tomato-to-toma', instruction: '소리 하나를 빼요.', audioText: '토마토에서 토마를 만들어요.', targetText: '토마토', targetResult: '토마', manipulationMode: 'remove', manipulationUnits: [unit('to1', '토'), unit('ma', '마'), unit('to2', '토')], manipulationTargetUnitIds: ['to2'], answer: 'to2', feedback },
  ],
}

export const replaceSyllableLesson: TrainingLesson = {
  id: 'replace-syllable',
  categoryId: 'phonological-awareness',
  title: '음절 바꾸기',
  description: '소리 하나를 다른 소리로 바꿔요.',
  activityType: 'sound-manipulation',
  estimatedMinutes: 12,
  questions: [
    { id: 'apple-to-boss', instruction: '소리를 바꿔서 만들어요.', audioText: '사과에서 사장을 만들어요.', targetText: '사과', targetResult: '사장', manipulationMode: 'replace', manipulationUnits: [unit('sa', '사'), unit('gwa', '과')], manipulationTargetUnitIds: ['gwa'], replacementChoices: [choice('jang', '장'), choice('ja', '자'), choice('go', '고')], replacementAnswerId: 'jang', answer: 'gwa:jang', feedback },
    { id: 'bag-to-scissors', instruction: '소리를 바꿔서 만들어요.', audioText: '가방에서 가위를 만들어요.', targetText: '가방', targetResult: '가위', manipulationMode: 'replace', manipulationUnits: [unit('ga', '가'), unit('bang', '방')], manipulationTargetUnitIds: ['bang'], replacementChoices: [choice('wi', '위'), choice('na', '나'), choice('ma', '마')], replacementAnswerId: 'wi', answer: 'bang:wi', feedback },
    { id: 'hat-to-sand', instruction: '소리를 바꿔서 만들어요.', audioText: '모자에서 모래를 만들어요.', targetText: '모자', targetResult: '모래', manipulationMode: 'replace', manipulationUnits: [unit('mo', '모'), unit('ja', '자')], manipulationTargetUnitIds: ['ja'], replacementChoices: [choice('ri', '리'), choice('rae', '래'), choice('ro', '로')], replacementAnswerId: 'rae', answer: 'ja:rae', feedback },
  ],
}
