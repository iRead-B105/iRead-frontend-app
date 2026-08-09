// 읽기 녹음의 최대 시간: 글자 수 × 0.5초.
// 짧은 글은 빨리, 긴 글은 길게 읽는 만큼 시간을 준다. 발화가 일찍 끝나면
// 침묵 감지가 먼저 녹음을 끝내므로 이 값은 상한이다.
// 하한 2초: 아이가 말을 시작하기까지의 반응 시간. 1.5초일 때 한 글자 문항
// (예: 따라 쓰기의 "난")에서 발화가 거의 담기지 않아 Azure가 Omission 0점을
// 돌려주는 문제가 있어 늘렸다.
// 상한 30초: useVoiceRecorder의 안전장치(MAX_RECORDING_MS)와 동일.
const MS_PER_LETTER = 500
const MIN_RECORDING_MS = 2_000
const MAX_RECORDING_MS = 30_000

export function readingRecordingMs(text: string | null | undefined): number {
  const letterCount = (text ?? '').replace(/\s+/g, '').length
  return Math.min(MAX_RECORDING_MS, Math.max(MIN_RECORDING_MS, letterCount * MS_PER_LETTER))
}
