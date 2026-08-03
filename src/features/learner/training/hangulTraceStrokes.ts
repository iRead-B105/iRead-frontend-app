import type { TracePoint } from '@/types/training'

/**
 * 한글 글리프에서 따라 쓰기 획을 동적으로 생성한다.
 *
 * 기존 traceAssets는 소수의 하드코딩 에셋뿐이라
 * 1) ㄱ·ㄴ처럼 1획인 글자가 여러 획으로 쪼개지고
 * 2) 획순이 표준과 다르며
 * 3) '비'처럼 에셋이 없는 글자는 엉뚱한 모양이 나오는 문제가 있었다.
 * 여기서는 자모별 표준 획(꺾임 포함 폴리라인)을 정의하고
 * 초성·중성·종성 배치 규칙으로 음절을 조립한다.
 *
 * 획수 기준: 국립국어원 표준 필순. 단 ㅈ·ㅊ의 삐침은 아동 따라 쓰기의
 * 시인성을 위해 가로획과 분리한다(교육 현장에서 통용되는 3·4획 방식).
 */

type UnitPoint = readonly [number, number]
type UnitStroke = readonly UnitPoint[]
type JamoStrokes = readonly UnitStroke[]
type Rect = { x: number; y: number; w: number; h: number }

// GazeTraceActivity의 SVG viewBox(640x500) 안에서 글자가 차지하는 영역
const AREA: Rect = { x: 160, y: 90, w: 320, h: 320 }
// 시선/포인터 판정 반경(46px)과 어울리는 안내점 간격
const SAMPLE_STEP_PX = 38

const circle = (cx: number, cy: number, r: number, segments = 14): UnitStroke => {
  const points: UnitPoint[] = []
  for (let index = 0; index <= segments; index += 1) {
    // 12시 방향에서 시작해 왼쪽(반시계)으로 돌아 제자리로 온다.
    const angle = -Math.PI / 2 - (2 * Math.PI * index) / segments
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
  }
  return points
}

// 기본 자음 14자. 각 획은 꺾임을 포함한 하나의 폴리라인이다.
const CONSONANTS: Readonly<Record<string, JamoStrokes>> = {
  'ㄱ': [[[0.08, 0.1], [0.9, 0.1], [0.9, 0.92]]],
  'ㄴ': [[[0.1, 0.08], [0.1, 0.9], [0.92, 0.9]]],
  'ㄷ': [
    [[0.1, 0.08], [0.9, 0.08]],
    [[0.1, 0.08], [0.1, 0.92], [0.92, 0.92]],
  ],
  'ㄹ': [
    [[0.08, 0.08], [0.9, 0.08], [0.9, 0.5]],
    [[0.08, 0.5], [0.9, 0.5]],
    [[0.08, 0.5], [0.08, 0.92], [0.92, 0.92]],
  ],
  'ㅁ': [
    [[0.1, 0.08], [0.1, 0.92]],
    [[0.1, 0.08], [0.9, 0.08], [0.9, 0.92]],
    [[0.1, 0.92], [0.9, 0.92]],
  ],
  'ㅂ': [
    [[0.1, 0.05], [0.1, 0.92]],
    [[0.9, 0.05], [0.9, 0.92]],
    [[0.1, 0.48], [0.9, 0.48]],
    [[0.1, 0.92], [0.9, 0.92]],
  ],
  'ㅅ': [
    [[0.5, 0.05], [0.08, 0.95]],
    [[0.5, 0.42], [0.92, 0.95]],
  ],
  'ㅇ': [circle(0.5, 0.5, 0.42)],
  'ㅈ': [
    [[0.06, 0.1], [0.94, 0.1]],
    [[0.5, 0.1], [0.08, 0.95]],
    [[0.5, 0.48], [0.92, 0.95]],
  ],
  'ㅊ': [
    [[0.32, 0.0], [0.68, 0.07]],
    [[0.06, 0.24], [0.94, 0.24]],
    [[0.5, 0.24], [0.1, 0.95]],
    [[0.5, 0.56], [0.9, 0.95]],
  ],
  'ㅋ': [
    [[0.08, 0.1], [0.9, 0.1], [0.9, 0.92]],
    [[0.08, 0.52], [0.66, 0.52]],
  ],
  'ㅌ': [
    [[0.1, 0.08], [0.9, 0.08]],
    [[0.1, 0.5], [0.9, 0.5]],
    [[0.1, 0.08], [0.1, 0.92], [0.92, 0.92]],
  ],
  'ㅍ': [
    [[0.06, 0.08], [0.94, 0.08]],
    [[0.3, 0.08], [0.3, 0.92]],
    [[0.7, 0.08], [0.7, 0.92]],
    [[0.06, 0.92], [0.94, 0.92]],
  ],
  'ㅎ': [
    [[0.32, 0.0], [0.68, 0.06]],
    [[0.08, 0.2], [0.92, 0.2]],
    circle(0.5, 0.63, 0.3),
  ],
}

const DOUBLE_CONSONANTS: Readonly<Record<string, readonly [string, string]>> = {
  'ㄲ': ['ㄱ', 'ㄱ'],
  'ㄸ': ['ㄷ', 'ㄷ'],
  'ㅃ': ['ㅂ', 'ㅂ'],
  'ㅆ': ['ㅅ', 'ㅅ'],
  'ㅉ': ['ㅈ', 'ㅈ'],
}

// 겹받침은 왼쪽·오른쪽 반칸에 두 자음을 나란히 놓는다.
const COMPOUND_FINALS: Readonly<Record<string, readonly [string, string]>> = {
  'ㄳ': ['ㄱ', 'ㅅ'],
  'ㄵ': ['ㄴ', 'ㅈ'],
  'ㄶ': ['ㄴ', 'ㅎ'],
  'ㄺ': ['ㄹ', 'ㄱ'],
  'ㄻ': ['ㄹ', 'ㅁ'],
  'ㄼ': ['ㄹ', 'ㅂ'],
  'ㄽ': ['ㄹ', 'ㅅ'],
  'ㄾ': ['ㄹ', 'ㅌ'],
  'ㄿ': ['ㄹ', 'ㅍ'],
  'ㅀ': ['ㄹ', 'ㅎ'],
  'ㅄ': ['ㅂ', 'ㅅ'],
}

// 세로 모음(초성 오른쪽에 붙는 형태). 획순: 왼쪽·위 획 먼저.
const VERTICAL_VOWELS: Readonly<Record<string, JamoStrokes>> = {
  'ㅣ': [[[0.5, 0.02], [0.5, 0.98]]],
  'ㅏ': [
    [[0.3, 0.02], [0.3, 0.98]],
    [[0.3, 0.5], [0.95, 0.5]],
  ],
  'ㅑ': [
    [[0.3, 0.02], [0.3, 0.98]],
    [[0.3, 0.34], [0.95, 0.34]],
    [[0.3, 0.64], [0.95, 0.64]],
  ],
  'ㅓ': [
    [[0.05, 0.5], [0.6, 0.5]],
    [[0.66, 0.02], [0.66, 0.98]],
  ],
  'ㅕ': [
    [[0.05, 0.34], [0.56, 0.34]],
    [[0.05, 0.64], [0.56, 0.64]],
    [[0.66, 0.02], [0.66, 0.98]],
  ],
  'ㅐ': [
    [[0.18, 0.02], [0.18, 0.98]],
    [[0.18, 0.5], [0.74, 0.5]],
    [[0.82, 0.02], [0.82, 0.98]],
  ],
  'ㅒ': [
    [[0.15, 0.02], [0.15, 0.98]],
    [[0.15, 0.34], [0.68, 0.34]],
    [[0.15, 0.64], [0.68, 0.64]],
    [[0.82, 0.02], [0.82, 0.98]],
  ],
  'ㅔ': [
    [[0.02, 0.5], [0.42, 0.5]],
    [[0.5, 0.02], [0.5, 0.98]],
    [[0.85, 0.02], [0.85, 0.98]],
  ],
  'ㅖ': [
    [[0.02, 0.34], [0.4, 0.34]],
    [[0.02, 0.64], [0.4, 0.64]],
    [[0.5, 0.02], [0.5, 0.98]],
    [[0.85, 0.02], [0.85, 0.98]],
  ],
}

// 가로 모음(초성 아래에 붙는 형태). 획순: 짧은 세로 → 긴 가로(ㅗ), 가로 → 세로(ㅜ).
const HORIZONTAL_VOWELS: Readonly<Record<string, JamoStrokes>> = {
  'ㅡ': [[[0.02, 0.5], [0.98, 0.5]]],
  'ㅗ': [
    [[0.5, 0.02], [0.5, 0.58]],
    [[0.02, 0.68], [0.98, 0.68]],
  ],
  'ㅛ': [
    [[0.35, 0.02], [0.35, 0.58]],
    [[0.65, 0.02], [0.65, 0.58]],
    [[0.02, 0.68], [0.98, 0.68]],
  ],
  'ㅜ': [
    [[0.02, 0.32], [0.98, 0.32]],
    [[0.5, 0.42], [0.5, 0.98]],
  ],
  'ㅠ': [
    [[0.02, 0.32], [0.98, 0.32]],
    [[0.35, 0.42], [0.35, 0.98]],
    [[0.65, 0.42], [0.65, 0.98]],
  ],
}

// 복합 모음 = 가로 성분 먼저, 세로 성분 나중 (쓰기 순서와 동일)
const COMPOUND_VOWELS: Readonly<Record<string, readonly [string, string]>> = {
  'ㅘ': ['ㅗ', 'ㅏ'],
  'ㅙ': ['ㅗ', 'ㅐ'],
  'ㅚ': ['ㅗ', 'ㅣ'],
  'ㅝ': ['ㅜ', 'ㅓ'],
  'ㅞ': ['ㅜ', 'ㅔ'],
  'ㅟ': ['ㅜ', 'ㅣ'],
  'ㅢ': ['ㅡ', 'ㅣ'],
}

const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const
const JUNGSEONG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
] as const
const JONGSEONG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const

const mapUnit = (
  strokes: JamoStrokes,
  transform: (point: UnitPoint) => UnitPoint,
): JamoStrokes => strokes.map((stroke) => stroke.map(transform))

// 쌍자음·겹받침처럼 한 칸을 좌우로 나눠 쓰는 자모를 unit box 안에서 조립한다.
const sideBySide = (left: JamoStrokes, right: JamoStrokes): JamoStrokes => [
  ...mapUnit(left, ([x, y]) => [x * 0.46, y]),
  ...mapUnit(right, ([x, y]) => [0.54 + x * 0.46, y]),
]

function consonantStrokes(jamo: string): JamoStrokes | null {
  const base = CONSONANTS[jamo]
  if (base) return base
  const pair = DOUBLE_CONSONANTS[jamo] ?? COMPOUND_FINALS[jamo]
  if (!pair) return null
  const left = CONSONANTS[pair[0]]
  const right = CONSONANTS[pair[1]]
  if (!left || !right) return null
  return sideBySide(left, right)
}

type VowelShape =
  | { kind: 'vertical'; strokes: JamoStrokes }
  | { kind: 'horizontal'; strokes: JamoStrokes }
  | { kind: 'compound'; horizontal: JamoStrokes; vertical: JamoStrokes }

function vowelShape(jamo: string): VowelShape | null {
  const vertical = VERTICAL_VOWELS[jamo]
  if (vertical) return { kind: 'vertical', strokes: vertical }
  const horizontal = HORIZONTAL_VOWELS[jamo]
  if (horizontal) return { kind: 'horizontal', strokes: horizontal }
  const pair = COMPOUND_VOWELS[jamo]
  if (!pair) return null
  const horizontalPart = HORIZONTAL_VOWELS[pair[0]]
  const verticalPart = VERTICAL_VOWELS[pair[1]]
  if (!horizontalPart || !verticalPart) return null
  return { kind: 'compound', horizontal: horizontalPart, vertical: verticalPart }
}

const subRect = (base: Rect, fx: number, fy: number, fw: number, fh: number): Rect => ({
  x: base.x + base.w * fx,
  y: base.y + base.h * fy,
  w: base.w * fw,
  h: base.h * fh,
})

function placeJamo(strokes: JamoStrokes, rect: Rect): TracePoint[][] {
  return strokes.map((stroke) => sampleStroke(
    stroke.map(([x, y]) => ({ x: rect.x + x * rect.w, y: rect.y + y * rect.h })),
  ))
}

// 꼭짓점 폴리라인을 판정 반경에 맞는 간격의 안내점으로 촘촘하게 만든다.
function sampleStroke(corners: TracePoint[]): TracePoint[] {
  const points: TracePoint[] = []
  for (let index = 0; index < corners.length - 1; index += 1) {
    const from = corners[index]!
    const to = corners[index + 1]!
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    const steps = Math.max(2, Math.round(length / SAMPLE_STEP_PX))
    for (let step = index === 0 ? 0 : 1; step <= steps; step += 1) {
      points.push({
        x: Math.round(from.x + ((to.x - from.x) * step) / steps),
        y: Math.round(from.y + ((to.y - from.y) * step) / steps),
      })
    }
  }
  return points
}

type Placement = { strokes: JamoStrokes; rect: Rect }

function syllablePlacements(cho: string, jung: string, jong: string): Placement[] | null {
  const choStrokes = consonantStrokes(cho)
  const vowel = vowelShape(jung)
  if (!choStrokes || !vowel) return null
  const jongStrokes = jong ? consonantStrokes(jong) : null
  if (jong && !jongStrokes) return null

  // 종성이 있으면 초성+중성을 위쪽 62%로 줄이고 아래에 종성을 놓는다.
  const main = jong ? subRect(AREA, 0, 0, 1, 0.62) : AREA
  const placements: Placement[] = []

  if (vowel.kind === 'vertical') {
    placements.push({ strokes: choStrokes, rect: subRect(main, 0.02, 0.1, 0.46, 0.8) })
    placements.push({ strokes: vowel.strokes, rect: subRect(main, 0.56, 0, 0.42, 1) })
  } else if (vowel.kind === 'horizontal') {
    placements.push({ strokes: choStrokes, rect: subRect(main, 0.2, 0, 0.6, 0.52) })
    placements.push({ strokes: vowel.strokes, rect: subRect(main, 0.05, 0.58, 0.9, 0.4) })
  } else {
    placements.push({ strokes: choStrokes, rect: subRect(main, 0.04, 0.02, 0.42, 0.44) })
    placements.push({ strokes: vowel.horizontal, rect: subRect(main, 0, 0.52, 0.6, 0.44) })
    placements.push({ strokes: vowel.vertical, rect: subRect(main, 0.66, 0, 0.32, 1) })
  }

  if (jongStrokes) {
    placements.push({ strokes: jongStrokes, rect: subRect(AREA, 0.18, 0.68, 0.64, 0.32) })
  }
  return placements
}

function jamoPlacements(jamo: string): Placement[] | null {
  const consonant = consonantStrokes(jamo)
  if (consonant) {
    return [{ strokes: consonant, rect: subRect(AREA, 0.2, 0.12, 0.6, 0.76) }]
  }
  const vowel = vowelShape(jamo)
  if (!vowel) return null
  if (vowel.kind === 'vertical') {
    return [{ strokes: vowel.strokes, rect: subRect(AREA, 0.3, 0.05, 0.4, 0.9) }]
  }
  if (vowel.kind === 'horizontal') {
    return [{ strokes: vowel.strokes, rect: subRect(AREA, 0.1, 0.25, 0.8, 0.5) }]
  }
  return [
    { strokes: vowel.horizontal, rect: subRect(AREA, 0.02, 0.3, 0.56, 0.4) },
    { strokes: vowel.vertical, rect: subRect(AREA, 0.66, 0.05, 0.32, 0.9) },
  ]
}

/**
 * 한글 음절·자모에서 따라 쓰기 획(캔버스 640x500 좌표)을 만든다.
 * 표현할 수 없는 글자면 null을 돌려주고, 호출부가 기존 에셋으로 폴백한다.
 */
export function getHangulTraceStrokes(glyph: string): TracePoint[][] | null {
  const char = [...glyph.trim()][0]
  if (!char) return null
  const code = char.codePointAt(0)!

  let placements: Placement[] | null = null
  if (code >= 0xac00 && code <= 0xd7a3) {
    const offset = code - 0xac00
    const cho = CHOSEONG[Math.floor(offset / (21 * 28))]!
    const jung = JUNGSEONG[Math.floor(offset / 28) % 21]!
    const jong = JONGSEONG[offset % 28]!
    placements = syllablePlacements(cho, jung, jong)
  } else {
    placements = jamoPlacements(char)
  }

  if (!placements) return null
  return placements.flatMap(({ strokes, rect }) => placeJamo(strokes, rect))
}
