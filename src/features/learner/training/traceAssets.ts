import type { TracePoint } from '@/types/training'

const line = (from: TracePoint, to: TracePoint, steps = 6): TracePoint[] =>
  Array.from({ length: steps }, (_, index) => ({
    x: from.x + ((to.x - from.x) * index) / (steps - 1),
    y: from.y + ((to.y - from.y) * index) / (steps - 1),
  }))

const traceAssets: Readonly<Record<string, TracePoint[][]>> = {
  vowel_a: [[
    ...line({ x: 365, y: 105 }, { x: 365, y: 405 }, 8),
    ...line({ x: 225, y: 255 }, { x: 365, y: 255 }, 5),
  ]],
}

export function getTraceAsset(assetKey: string): TracePoint[][] {
  const strokes = traceAssets[assetKey]
  if (!strokes) {
    throw new TypeError(`지원하지 않는 글자 따라 보기 에셋입니다: ${assetKey}`)
  }
  return strokes.map((stroke) => stroke.map((point) => ({ ...point })))
}
