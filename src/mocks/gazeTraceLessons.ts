import type { TracePoint, TrainingLesson } from '@/types/training'

const line = (from: TracePoint, to: TracePoint, steps = 6): TracePoint[] =>
  Array.from({ length: steps }, (_, index) => ({
    x: from.x + ((to.x - from.x) * index) / (steps - 1),
    y: from.y + ((to.y - from.y) * index) / (steps - 1),
  }))

const shapes: Record<string, TracePoint[][]> = {
  'ㄱ': [[...line({ x: 180, y: 145 }, { x: 425, y: 145 }), ...line({ x: 425, y: 145 }, { x: 425, y: 385 }).slice(1)]],
  'ㄴ': [[...line({ x: 205, y: 125 }, { x: 205, y: 380 }), ...line({ x: 205, y: 380 }, { x: 445, y: 380 }).slice(1)]],
  'ㅁ': [line({ x: 205, y: 130 }, { x: 205, y: 385 }), line({ x: 205, y: 130 }, { x: 435, y: 130 }), line({ x: 435, y: 130 }, { x: 435, y: 385 }), line({ x: 205, y: 385 }, { x: 435, y: 385 })],
  'ㅏ': [line({ x: 290, y: 105 }, { x: 290, y: 405 }, 8), line({ x: 290, y: 255 }, { x: 430, y: 255 }, 5)],
  'ㅓ': [line({ x: 365, y: 105 }, { x: 365, y: 405 }, 8), line({ x: 225, y: 255 }, { x: 365, y: 255 }, 5)],
  'ㅗ': [line({ x: 320, y: 125 }, { x: 320, y: 275 }, 5), line({ x: 170, y: 275 }, { x: 470, y: 275 }, 8)],
  '가': [line({ x: 120, y: 145 }, { x: 285, y: 145 }, 5), line({ x: 285, y: 145 }, { x: 285, y: 365 }, 6), line({ x: 405, y: 105 }, { x: 405, y: 405 }, 8), line({ x: 405, y: 255 }, { x: 510, y: 255 }, 4)],
  '너': [line({ x: 145, y: 120 }, { x: 145, y: 375 }, 7), line({ x: 145, y: 375 }, { x: 285, y: 375 }, 5), line({ x: 450, y: 105 }, { x: 450, y: 405 }, 8), line({ x: 345, y: 255 }, { x: 450, y: 255 }, 4)],
  '모': [line({ x: 115, y: 130 }, { x: 115, y: 315 }, 5), line({ x: 115, y: 130 }, { x: 275, y: 130 }, 5), line({ x: 275, y: 130 }, { x: 275, y: 315 }, 5), line({ x: 115, y: 315 }, { x: 275, y: 315 }, 5), line({ x: 435, y: 145 }, { x: 435, y: 275 }, 4), line({ x: 340, y: 275 }, { x: 530, y: 275 }, 5)],
}

const question = (id: string, glyph: string, aliases: string[]) => ({
  id,
  instruction: '눈으로 길을 따라가요.',
  targetText: glyph,
  traceGlyph: glyph,
  traceStrokes: shapes[glyph],
  speechAliases: aliases,
  answer: glyph,
  feedback: {
    correct: `${glyph}, 또렷하게 잘 말했어요!`,
    retry: `괜찮아요. ${glyph} 소리를 듣고 다시 말해봐요.`,
  },
})

export const traceConsonantLesson: TrainingLesson = {
  id: 'trace-consonant', categoryId: 'phonics', title: '자음 따라 보기',
  description: '눈으로 자음의 획을 따라가고 소리를 말해요.', activityType: 'gaze-trace', estimatedMinutes: 8,
  questions: [question('q1', 'ㄱ', ['ㄱ', '기역', '그']), question('q2', 'ㄴ', ['ㄴ', '니은', '느']), question('q3', 'ㅁ', ['ㅁ', '미음', '므'])],
}

export const traceVowelLesson: TrainingLesson = {
  id: 'trace-vowel', categoryId: 'phonics', title: '모음 따라 보기',
  description: '눈으로 모음의 획을 따라가고 소리를 말해요.', activityType: 'gaze-trace', estimatedMinutes: 8,
  questions: [question('q1', 'ㅏ', ['ㅏ', '아']), question('q2', 'ㅓ', ['ㅓ', '어']), question('q3', 'ㅗ', ['ㅗ', '오'])],
}

export const traceSyllableLesson: TrainingLesson = {
  id: 'trace-syllable', categoryId: 'phonics', title: '글자 따라 보기',
  description: '눈으로 완성 글자를 따라가고 소리 내어 읽어요.', activityType: 'gaze-trace', estimatedMinutes: 10,
  questions: [question('q1', '가', ['가']), question('q2', '너', ['너']), question('q3', '모', ['모'])],
}
