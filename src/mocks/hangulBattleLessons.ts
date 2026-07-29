import type { HangulBattleRound, TrainingLesson } from '@/types/training'

const round = (
  id: string,
  word: string,
  answer: string[],
  pool: string[],
  opponentDurationMs: number,
): HangulBattleRound => ({
  id,
  word,
  answer,
  opponentDurationMs,
  tiles: pool.map((text, index) => ({ id: `${id}-${index}`, text })),
})

export const rabbitBattleLesson: TrainingLesson = {
  id: 'battle-rabbit',
  categoryId: 'phonics',
  title: '토끼와 한글 대결',
  description: '토끼보다 먼저 자음과 모음을 모아 낱말을 만들어요.',
  activityType: 'hangul-battle',
  estimatedMinutes: 8,
  questions: [{
    id: 'rabbit-match',
    instruction: '토끼보다 먼저 만들어요!',
    answer: 'battle-complete',
    battleOpponent: 'rabbit',
    battleRounds: [
      round('rabbit-butterfly', '나비', ['ㄴ', 'ㅏ', 'ㅂ', 'ㅣ'], ['ㅂ', 'ㅗ', 'ㄴ', 'ㅣ', 'ㄷ', 'ㅏ', 'ㅁ', 'ㅓ'], 22000),
      round('rabbit-hat', '모자', ['ㅁ', 'ㅗ', 'ㅈ', 'ㅏ'], ['ㅊ', 'ㅗ', 'ㅁ', 'ㅜ', 'ㅈ', 'ㄴ', 'ㅏ', 'ㅓ'], 21000),
      round('rabbit-scissors', '가위', ['ㄱ', 'ㅏ', 'ㅇ', 'ㅟ'], ['ㅟ', 'ㄴ', 'ㅗ', 'ㄱ', 'ㅁ', 'ㅇ', 'ㅏ', 'ㅣ'], 20000),
    ],
    feedback: { correct: '한글 대결을 마쳤어요!', retry: '다시 도전해봐요.' },
  }],
}

export const turtleBattleLesson: TrainingLesson = {
  id: 'battle-turtle',
  categoryId: 'phonics',
  title: '거북이와 한글 대결',
  description: '거북이보다 먼저 받침 낱말을 만들어요.',
  activityType: 'hangul-battle',
  estimatedMinutes: 10,
  questions: [{
    id: 'turtle-match',
    instruction: '거북이보다 먼저 만들어요!',
    answer: 'battle-complete',
    battleOpponent: 'turtle',
    battleRounds: [
      round('turtle-potato', '감자', ['ㄱ', 'ㅏ', 'ㅁ', 'ㅈ', 'ㅏ'], ['ㅈ', 'ㅏ', 'ㄴ', 'ㅁ', 'ㅓ', 'ㄱ', 'ㅏ', 'ㅗ'], 17000),
      round('turtle-octopus', '문어', ['ㅁ', 'ㅜ', 'ㄴ', 'ㅇ', 'ㅓ'], ['ㅇ', 'ㅏ', 'ㅁ', 'ㄹ', 'ㅓ', 'ㄴ', 'ㅜ', 'ㅗ'], 16000),
      round('turtle-moonlight', '달빛', ['ㄷ', 'ㅏ', 'ㄹ', 'ㅂ', 'ㅣ', 'ㅊ'], ['ㅂ', 'ㅏ', 'ㅊ', 'ㄷ', 'ㅗ', 'ㄹ', 'ㅣ', 'ㅁ', 'ㅓ'], 15000),
    ],
    feedback: { correct: '한글 대결을 마쳤어요!', retry: '다시 도전해봐요.' },
  }],
}

export const antBattleLesson: TrainingLesson = {
  id: 'battle-ant',
  categoryId: 'phonics',
  title: '개미와 한글 대결',
  description: '개미보다 먼저 겹받침 낱말을 만들어요.',
  activityType: 'hangul-battle',
  estimatedMinutes: 12,
  questions: [{
    id: 'ant-match',
    instruction: '개미보다 먼저 만들어요!',
    answer: 'battle-complete',
    battleOpponent: 'ant',
    battleRounds: [
      round('ant-chicken', '닭', ['ㄷ', 'ㅏ', 'ㄹ', 'ㄱ'], ['ㄱ', 'ㅏ', 'ㄴ', 'ㄹ', 'ㅁ', 'ㄷ', 'ㅓ', 'ㅂ'], 13000),
      round('ant-price', '값', ['ㄱ', 'ㅏ', 'ㅂ', 'ㅅ'], ['ㅅ', 'ㅓ', 'ㄱ', 'ㅁ', 'ㅂ', 'ㅏ', 'ㄴ', 'ㅗ'], 12000),
      round('ant-life', '삶', ['ㅅ', 'ㅏ', 'ㄹ', 'ㅁ'], ['ㅁ', 'ㅗ', 'ㄴ', 'ㅏ', 'ㄹ', 'ㅅ', 'ㅂ', 'ㅓ'], 11000),
    ],
    feedback: { correct: '한글 대결을 마쳤어요!', retry: '다시 도전해봐요.' },
  }],
}
