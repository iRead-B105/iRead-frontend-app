const tutorialFamilyByTrainingId: Record<string, string> = {
  // 획순을 시선으로 따라가고 마지막에 말하는 흐름
  'trace-consonant': 'gaze-trace',
  'trace-vowel': 'gaze-trace',
  'trace-syllable': 'gaze-trace',

  // 소리를 듣고 글자·낱말 카드를 고르는 흐름
  'letter-sound-choice': 'sound-choice',
  'word-first-sound-choice': 'sound-choice',
  'first-sound': 'sound-choice',
  'last-sound': 'sound-choice',
  'same-sound': 'sound-choice',
  'batchim-sound': 'sound-choice',
  'similar-sound': 'sound-choice',

  // 글자 조각을 골라 글자를 만드는 흐름
  'build-basic-letter': 'letter-build',
  'build-batchim-letter': 'letter-build',
  'build-double-batchim-letter': 'letter-build',

  // 소리·음절 카드를 조작하는 흐름
  'remove-batchim': 'sound-manipulation',
  'sound-split': 'sound-manipulation',
  'replace-syllable': 'sound-manipulation',
  'sound-combine': 'sound-manipulation',

  // 낱말·문장·짧은 글을 읽고 마이크로 말하는 흐름
  'read-real-words': 'reading',
  'read-nonwords': 'reading',
  'read-short-sentences': 'reading',
  'read-sentences': 'reading',
  'read-short-passage': 'reading',
  'follow-sentence': 'reading',
  'word-chain': 'reading',
  'phrase-reading': 'reading',
  're-read': 'reading',
  'short-story': 'reading',

  // 문장·그림·빈칸을 확인하고 답을 고르는 흐름
  'fill-blank': 'short-text-choice',
  'match-picture': 'short-text-choice',
  'sentence-choice': 'short-text-choice',
  'sentence-order': 'short-text-choice',
}

export const getTutorialFamily = (trainingKey: string): string => {
  const [, , trainingId, activityType] = trainingKey.split(':')
  return tutorialFamilyByTrainingId[trainingId ?? ''] ?? `activity:${activityType ?? 'unknown'}`
}
