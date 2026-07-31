import { describe, expect, it } from 'vitest'
import { getTraceAsset } from './traceAssets'

const deterministicDemoAssetKeys = [
  ...Array.from({ length: 5 }, (_, index) => `vowel_${index}`),
  ...Array.from({ length: 5 }, (_, index) => `consonant_${index}`),
  ...Array.from({ length: 5 }, (_, index) => `syllable_${index}`),
]

describe('trace assets', () => {
  it.each(deterministicDemoAssetKeys)('%s demo ??? ?? ??? ????', (assetKey) => {
    const strokes = getTraceAsset(assetKey)

    expect(strokes.length).toBeGreaterThan(0)
    expect(strokes.every((stroke) => stroke.length >= 2)).toBe(true)
  })

  it('??? ??? ?? ?? ??? ??? ?? ???', () => {
    const strokes = getTraceAsset('vowel_0')
    strokes[0]![0]!.x = -1

    expect(getTraceAsset('vowel_0')[0]![0]!.x).not.toBe(-1)
  })
})
