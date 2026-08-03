const consonantWithEu: Readonly<Record<string, string>> = {
  'ㄱ': '그',
  'ㄲ': '끄',
  'ㄴ': '느',
  'ㄷ': '드',
  'ㄸ': '뜨',
  'ㄹ': '르',
  'ㅁ': '므',
  'ㅂ': '브',
  'ㅃ': '쁘',
  'ㅅ': '스',
  'ㅆ': '쓰',
  'ㅇ': '으',
  'ㅈ': '즈',
  'ㅉ': '쯔',
  'ㅊ': '츠',
  'ㅋ': '크',
  'ㅌ': '트',
  'ㅍ': '프',
  'ㅎ': '흐',
}

export function consonantPronunciationText(text: string): string {
  return consonantWithEu[text] ?? text
}
