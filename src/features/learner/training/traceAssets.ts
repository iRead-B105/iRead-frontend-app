import type { TracePoint } from '@/types/training'

const line = (from: TracePoint, to: TracePoint, steps = 6): TracePoint[] =>
  Array.from({ length: steps }, (_, index) => ({
    x: from.x + ((to.x - from.x) * index) / (steps - 1),
    y: from.y + ((to.y - from.y) * index) / (steps - 1),
  }))

const traceAssets: Readonly<Record<string, TracePoint[][]>> = {
  vowel_a: [
    line({ x: 290, y: 105 }, { x: 290, y: 405 }, 8),
    line({ x: 290, y: 255 }, { x: 430, y: 255 }, 5),
  ],
  vowel_0: [
    line({ x: 290, y: 105 }, { x: 290, y: 405 }, 8),
    line({ x: 290, y: 255 }, { x: 430, y: 255 }, 5),
  ],
  consonant_0: [
    line({ x: 210, y: 150 }, { x: 390, y: 150 }, 6),
    line({ x: 390, y: 150 }, { x: 390, y: 390 }, 8),
  ],
  syllable_0: [
    line({ x: 155, y: 155 }, { x: 285, y: 155 }, 5),
    line({ x: 285, y: 155 }, { x: 285, y: 385 }, 7),
    line({ x: 405, y: 125 }, { x: 405, y: 415 }, 8),
    line({ x: 320, y: 270 }, { x: 405, y: 270 }, 4),
  ],
}

export function getTraceAsset(assetKey: string): TracePoint[][] {
  const strokes = traceAssets[assetKey]
  if (!strokes) {
    throw new TypeError(`지원하지 않는 글자 따라 보기 에셋입니다: ${assetKey}`)
  }
  return strokes.map((stroke) => stroke.map((point) => ({ ...point })))
}
