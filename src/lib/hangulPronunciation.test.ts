import { describe, expect, it } from 'vitest'
import { consonantPronunciationText } from './hangulPronunciation'

describe('자음 발음용 텍스트', () => {
  it.each([
    ['ㄱ', '그'], ['ㄲ', '끄'], ['ㄴ', '느'], ['ㄷ', '드'], ['ㄸ', '뜨'],
    ['ㄹ', '르'], ['ㅁ', '므'], ['ㅂ', '브'], ['ㅃ', '쁘'], ['ㅅ', '스'],
    ['ㅆ', '쓰'], ['ㅇ', '으'], ['ㅈ', '즈'], ['ㅉ', '쯔'], ['ㅊ', '츠'],
    ['ㅋ', '크'], ['ㅌ', '트'], ['ㅍ', '프'], ['ㅎ', '흐'],
  ])('%s를 %s로 변환한다', (consonant, expected) => {
    expect(consonantPronunciationText(consonant)).toBe(expected)
  })

  it.each(['ㅏ', '가', '사과'])('%s는 변경하지 않는다', (text) => {
    expect(consonantPronunciationText(text)).toBe(text)
  })
})
