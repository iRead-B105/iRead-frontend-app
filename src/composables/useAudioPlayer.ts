// 오디오 플레이어 composable (목업용)
//
// 본 목업에서는 브라우저의 SpeechSynthesis(TTS)를 사용해 소리를 재생합니다.
// 실제 서비스에서는 아동용으로 검수된 녹음 음성 파일(또는 전용 TTS)로 교체해야 합니다.
// 본 파일은 "재생" 동작만 담당하며 STT 점수 측정/발음 평가를 수행하지 않습니다.

import { ref } from 'vue'

// 모듀 단위 단일 인스턴스: 여러 컴포넌트가 같은 재생 상태를 공유합니다.
const isPlaying = ref(false)
const currentText = ref<string | null>(null)

const isSupported = (): boolean =>
  typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined'

// 텍스트를 소리 내어 읽어줍니다.
// 이미 같은 문장을 재생 중이면 무시하여 중복 재생을 막습니다(재생/일시정지/정지/다시듣기 지원).
const speak = (text: string, rate = 0.9): Promise<void> => {
  if (!isSupported()) {
    console.warn('[useAudioPlayer] SpeechSynthesis 미지원 환경입니다.')
    return Promise.resolve()
  }

  // 중복 재생 방지: 동일 텍스트가 이미 재생 중이면 무시
  if (isPlaying.value && currentText.value === text) {
    return Promise.resolve()
  }

  // 새 재생을 시작하기 전 진행 중이던 음성은 정지(취소)
  window.speechSynthesis.cancel()

  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ko-KR'
    utterance.rate = rate
    utterance.pitch = 1.1

    currentText.value = text
    isPlaying.value = true

    utterance.onend = () => {
      isPlaying.value = false
      currentText.value = null
      resolve()
    }
    utterance.onerror = () => {
      isPlaying.value = false
      currentText.value = null
      resolve()
    }

    window.speechSynthesis.speak(utterance)
  })
}

// 자음/모음 단독 소리. TTS가 정확히 발음하지 못할 수 있어 목업용으로 사용합니다.
const playLetterSound = (letter: string): Promise<void> => speak(letter, 0.7)

// 여러 소리를 순서대로 재생합니다(예: 자음 → 모음 → 완성된 글자).
const playSequence = async (items: string[], rate = 0.85): Promise<void> => {
  for (const item of items) {
    await speak(item, rate)
  }
}

// 정지
const stop = (): void => {
  if (isSupported()) {
    window.speechSynthesis.cancel()
  }
  isPlaying.value = false
  currentText.value = null
}

// 다시 듣기: 정지 후 동일 문장을 새로 재생합니다.
const replay = (text: string, rate = 0.9): Promise<void> => {
  stop()
  return speak(text, rate)
}

export function useAudioPlayer() {
  return {
    isPlaying,
    currentText,
    speak,
    playLetterSound,
    playSequence,
    stop,
    replay,
  }
}
