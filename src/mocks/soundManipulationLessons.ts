import type { SoundManipulationUnit, TrainingChoice, TrainingLesson } from '@/types/training'

const unit = (id: string, text: string): SoundManipulationUnit => ({ id, text })
const choice = (id: string, text: string): TrainingChoice => ({ id, text })
const feedback = { correct: '잘했어!', retry: '소리를 다시 눌러봐요.' }

export const removeBatchimLesson: TrainingLesson = {
  id: 'remove-batchim',
  categoryId: 'phonological-awareness',
  title: '받침 빼기',
  description: '받침 소리를 빼서 새 글자를 만들어요.',
  activityType: 'sound-omit',
  estimatedMinutes: 10,
  questions: [
    { id: 'dak-to-da', instruction: '받침 소리를 빼봐요.', subInstruction: '닭에서 받침 소리를 빼고, 들은 소리를 만들어요.', targetText: '닭', audioText: '다', soundParts: ['ㄷ', 'ㅏ', 'ㄺ'], targetResult: 'ㄷㅏ', answer: '다', feedback },
    { id: 'gam-to-ga', instruction: '받침 소리를 빼봐요.', subInstruction: '감에서 받침 소리를 빼고, 들은 소리를 만들어요.', targetText: '감', audioText: '가', soundParts: ['ㄱ', 'ㅏ', 'ㅁ'], targetResult: 'ㄱㅏ', answer: '가', feedback },
    { id: 'gap-to-ga', instruction: '받침 소리를 빼봐요.', subInstruction: '값에서 받침 소리를 빼고, 들은 소리를 만들어요.', targetText: '값', audioText: '가', soundParts: ['ㄱ', 'ㅏ', 'ㅄ'], targetResult: 'ㄱㅏ', answer: '가', feedback },
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
    { id: 'apple-to-boss', instruction: '바꿀 소리와 새 소리를 골라봐요.', audioText: '사과에서 사장을 만들어요.', targetText: '사과', targetResult: '사장', manipulationMode: 'replace', manipulationUnits: [unit('sa', '사'), unit('gwa', '과')], manipulationTargetUnitIds: ['gwa'], replacementChoices: [choice('jang', '장'), choice('ja', '자'), choice('go', '고')], replacementAnswerId: 'jang', answer: 'gwa:jang', feedback },
    { id: 'bag-to-scissors', instruction: '바꿀 소리와 새 소리를 골라봐요.', audioText: '가방에서 가위를 만들어요.', targetText: '가방', targetResult: '가위', manipulationMode: 'replace', manipulationUnits: [unit('ga', '가'), unit('bang', '방')], manipulationTargetUnitIds: ['bang'], replacementChoices: [choice('wi', '위'), choice('na', '나'), choice('ma', '마')], replacementAnswerId: 'wi', answer: 'bang:wi', feedback },
    { id: 'hat-to-sand', instruction: '바꿀 소리와 새 소리를 골라봐요.', audioText: '모자에서 모래를 만들어요.', targetText: '모자', targetResult: '모래', manipulationMode: 'replace', manipulationUnits: [unit('mo', '모'), unit('ja', '자')], manipulationTargetUnitIds: ['ja'], replacementChoices: [choice('ri', '리'), choice('rae', '래'), choice('ro', '로')], replacementAnswerId: 'rae', answer: 'ja:rae', feedback },
  ],
}
