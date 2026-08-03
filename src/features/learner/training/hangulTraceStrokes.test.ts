import { describe, expect, it } from 'vitest'
import { getHangulTraceStrokes } from './hangulTraceStrokes'

const strokeCount = (glyph: string) => getHangulTraceStrokes(glyph)?.length

const allPoints = (glyph: string) => {
  const strokes = getHangulTraceStrokes(glyph)
  expect(strokes).not.toBeNull()
  return strokes!.flat()
}

const boundsOf = (points: ReturnType<typeof allPoints>) => ({
  minX: Math.min(...points.map((p) => p.x)),
  maxX: Math.max(...points.map((p) => p.x)),
  minY: Math.min(...points.map((p) => p.y)),
  maxY: Math.max(...points.map((p) => p.y)),
})

describe('한글 따라 쓰기 획 생성', () => {
  it('ㄱ·ㄴ은 꺾임을 포함한 한 획으로 생성된다 (획 쪼개짐 방지)', () => {
    expect(strokeCount('ㄱ')).toBe(1)
    expect(strokeCount('ㄴ')).toBe(1)
  })

  it('표준 획수를 따른다', () => {
    expect(strokeCount('ㄷ')).toBe(2)
    expect(strokeCount('ㄹ')).toBe(3)
    expect(strokeCount('ㅁ')).toBe(3)
    expect(strokeCount('ㅂ')).toBe(4)
    expect(strokeCount('ㅇ')).toBe(1)
    expect(strokeCount('ㅏ')).toBe(2)
    expect(strokeCount('ㅗ')).toBe(2)
    expect(strokeCount('가')).toBe(3) // ㄱ1 + ㅏ2
    expect(strokeCount('비')).toBe(5) // ㅂ4 + ㅣ1
    expect(strokeCount('문')).toBe(6) // ㅁ3 + ㅜ2 + ㄴ1
    expect(strokeCount('와')).toBe(5) // ㅇ1 + ㅗ2 + ㅏ2
    expect(strokeCount('닭')).toBe(8) // ㄷ2 + ㅏ2 + ㄺ4(ㄹ3+ㄱ1)
  })

  it('획순: ㅏ는 세로 획을 먼저 긋고 짧은 가로 획을 나중에 긋는다', () => {
    const strokes = getHangulTraceStrokes('ㅏ')!
    const [first, second] = strokes
    // 첫 획은 세로(시작·끝 x 동일), 둘째 획은 왼쪽→오른쪽 가로
    expect(first![0]!.x).toBe(first!.at(-1)!.x)
    expect(second!.at(-1)!.x).toBeGreaterThan(second![0]!.x)
  })

  it('획순: ㄷ은 위 가로 획을 먼저 긋는다', () => {
    const strokes = getHangulTraceStrokes('ㄷ')!
    const firstStrokeY = strokes[0]![0]!.y
    const secondStrokeMaxY = Math.max(...strokes[1]!.map((p) => p.y))
    expect(firstStrokeY).toBeLessThan(secondStrokeMaxY)
  })

  it('음절 배치: 세로 모음은 초성 오른쪽에 놓인다', () => {
    const strokes = getHangulTraceStrokes('비')!
    const consonant = boundsOf(strokes.slice(0, 4).flat())
    const vowel = boundsOf(strokes.slice(4).flat())
    expect(vowel.minX).toBeGreaterThan(consonant.maxX)
  })

  it('음절 배치: 가로 모음은 초성 아래, 종성은 그 아래에 놓인다', () => {
    const strokes = getHangulTraceStrokes('문')!
    const cho = boundsOf(strokes.slice(0, 3).flat()) // ㅁ
    const jung = boundsOf(strokes.slice(3, 5).flat()) // ㅜ
    const jong = boundsOf(strokes.slice(5).flat()) // ㄴ
    expect(jung.minY).toBeGreaterThan(cho.maxY - 1)
    expect(jong.minY).toBeGreaterThan(jung.maxY - 1)
  })

  it('모든 점이 캔버스(640x500) 안에 있다', () => {
    for (const glyph of ['ㄱ', 'ㅘ', '가', '비', '문', '닭', '꿈', '흙', '왜']) {
      const bounds = boundsOf(allPoints(glyph))
      expect(bounds.minX).toBeGreaterThanOrEqual(0)
      expect(bounds.maxX).toBeLessThanOrEqual(640)
      expect(bounds.minY).toBeGreaterThanOrEqual(0)
      expect(bounds.maxY).toBeLessThanOrEqual(500)
    }
  })

  it('안내점 간격이 판정 반경(46px)보다 촘촘하다', () => {
    for (const glyph of ['가', '비', '문']) {
      for (const stroke of getHangulTraceStrokes(glyph)!) {
        for (let index = 1; index < stroke.length; index += 1) {
          const gap = Math.hypot(
            stroke[index]!.x - stroke[index - 1]!.x,
            stroke[index]!.y - stroke[index - 1]!.y,
          )
          expect(gap).toBeLessThanOrEqual(46)
        }
      }
    }
  })

  it('모든 현대 한글 음절을 생성할 수 있다 (샘플링)', () => {
    for (let code = 0xac00; code <= 0xd7a3; code += 97) {
      const glyph = String.fromCodePoint(code)
      const strokes = getHangulTraceStrokes(glyph)
      expect(strokes, `${glyph} 생성 실패`).not.toBeNull()
      expect(strokes!.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('한글이 아니면 null을 돌려준다', () => {
    expect(getHangulTraceStrokes('A')).toBeNull()
    expect(getHangulTraceStrokes('1')).toBeNull()
    expect(getHangulTraceStrokes('')).toBeNull()
  })
})
