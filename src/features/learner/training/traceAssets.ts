import type { TracePoint } from '@/types/training'

const line = (from: TracePoint, to: TracePoint, steps = 6): TracePoint[] =>
  Array.from({ length: steps }, (_, index) => ({
    x: from.x + ((to.x - from.x) * index) / (steps - 1),
    y: from.y + ((to.y - from.y) * index) / (steps - 1),
  }))

const vowelA: TracePoint[][] = [
  line({ x: 300, y: 105 }, { x: 300, y: 405 }, 8),
  line({ x: 300, y: 255 }, { x: 430, y: 255 }, 5),
]

const traceAssets: Readonly<Record<string, TracePoint[][]>> = {
  vowel_a: vowelA,
  vowel_0: vowelA,
  vowel_1: [
    line({ x: 300, y: 105 }, { x: 300, y: 405 }, 8),
    line({ x: 170, y: 255 }, { x: 300, y: 255 }, 5),
  ],
  vowel_2: [
    line({ x: 180, y: 330 }, { x: 420, y: 330 }, 7),
    line({ x: 300, y: 120 }, { x: 300, y: 330 }, 6),
  ],
  vowel_3: [
    line({ x: 180, y: 180 }, { x: 420, y: 180 }, 7),
    line({ x: 300, y: 180 }, { x: 300, y: 390 }, 6),
  ],
  vowel_4: [
    line({ x: 300, y: 105 }, { x: 300, y: 405 }, 8),
  ],
  consonant_0: [
    line({ x: 210, y: 150 }, { x: 390, y: 150 }, 6),
    line({ x: 390, y: 150 }, { x: 390, y: 390 }, 8),
  ],
  consonant_1: [
    line({ x: 210, y: 140 }, { x: 210, y: 390 }, 8),
    line({ x: 210, y: 390 }, { x: 400, y: 390 }, 6),
  ],
  consonant_2: [
    line({ x: 210, y: 140 }, { x: 400, y: 140 }, 6),
    line({ x: 210, y: 140 }, { x: 210, y: 390 }, 8),
    line({ x: 210, y: 390 }, { x: 400, y: 390 }, 6),
  ],
  consonant_3: [[
    ...line({ x: 210, y: 130 }, { x: 400, y: 130 }, 6),
    ...line({ x: 400, y: 130 }, { x: 400, y: 250 }, 5).slice(1),
    ...line({ x: 400, y: 250 }, { x: 210, y: 250 }, 6).slice(1),
    ...line({ x: 210, y: 250 }, { x: 210, y: 390 }, 5).slice(1),
    ...line({ x: 210, y: 390 }, { x: 400, y: 390 }, 6).slice(1),
  ]],
  consonant_4: [
    line({ x: 210, y: 140 }, { x: 400, y: 140 }, 6),
    line({ x: 210, y: 140 }, { x: 210, y: 390 }, 8),
    line({ x: 400, y: 140 }, { x: 400, y: 390 }, 8),
    line({ x: 210, y: 390 }, { x: 400, y: 390 }, 6),
  ],
  syllable_0: [
    line({ x: 130, y: 155 }, { x: 275, y: 155 }, 5),
    line({ x: 275, y: 155 }, { x: 275, y: 385 }, 7),
    line({ x: 405, y: 125 }, { x: 405, y: 415 }, 8),
    line({ x: 405, y: 270 }, { x: 490, y: 270 }, 4),
  ],
  syllable_1: [
    line({ x: 130, y: 140 }, { x: 130, y: 385 }, 7),
    line({ x: 130, y: 385 }, { x: 275, y: 385 }, 5),
    line({ x: 405, y: 125 }, { x: 405, y: 415 }, 8),
    line({ x: 320, y: 270 }, { x: 405, y: 270 }, 4),
  ],
  syllable_2: [
    line({ x: 180, y: 110 }, { x: 420, y: 110 }, 7),
    line({ x: 180, y: 110 }, { x: 180, y: 260 }, 5),
    line({ x: 180, y: 260 }, { x: 420, y: 260 }, 7),
    line({ x: 180, y: 365 }, { x: 420, y: 365 }, 7),
    line({ x: 300, y: 260 }, { x: 300, y: 365 }, 4),
  ],
  syllable_3: [
    line({ x: 180, y: 95 }, { x: 420, y: 95 }, 7),
    line({ x: 180, y: 95 }, { x: 180, y: 245 }, 5),
    line({ x: 420, y: 95 }, { x: 420, y: 245 }, 5),
    line({ x: 180, y: 245 }, { x: 420, y: 245 }, 7),
    line({ x: 180, y: 340 }, { x: 420, y: 340 }, 7),
    line({ x: 300, y: 340 }, { x: 300, y: 440 }, 4),
  ],
  syllable_4: [
    line({ x: 130, y: 120 }, { x: 270, y: 120 }, 5),
    line({ x: 130, y: 120 }, { x: 130, y: 390 }, 7),
    line({ x: 270, y: 120 }, { x: 270, y: 390 }, 7),
    line({ x: 130, y: 255 }, { x: 270, y: 255 }, 5),
    line({ x: 130, y: 390 }, { x: 270, y: 390 }, 5),
    line({ x: 410, y: 105 }, { x: 410, y: 405 }, 8),
  ],
}

export function getTraceAsset(assetKey: string): TracePoint[][] {
  const strokes = traceAssets[assetKey]
  if (!strokes) {
    throw new TypeError(`지원하지 않는 글자 따라 보기 에셋입니다: ${assetKey}`)
  }
  return strokes.map((stroke) => stroke.map((point) => ({ ...point })))
}
