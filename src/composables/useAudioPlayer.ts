import { ref } from 'vue'
import { typecastTtsClient } from '@/services/typecastTtsClient'

const isPlaying = ref(false)
const currentText = ref<string | null>(null)

let activeAudio: HTMLAudioElement | null = null
let activeObjectUrl: string | null = null
let settlePlayback: (() => void) | null = null
let playbackSequence = 0

const clearPlayback = (): void => {
  activeAudio?.pause()
  activeAudio = null
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl)
  activeObjectUrl = null
  isPlaying.value = false
  currentText.value = null
  const settle = settlePlayback
  settlePlayback = null
  settle?.()
}

const stop = (): void => {
  playbackSequence += 1
  clearPlayback()
}

const speak = async (text: string, rate = 0.9): Promise<void> => {
  const normalizedText = text.trim()
  if (!normalizedText) return
  if (isPlaying.value && currentText.value === normalizedText) return

  stop()
  const sequence = playbackSequence
  currentText.value = normalizedText

  try {
    const audioBlob = await typecastTtsClient.synthesize(normalizedText, rate)
    if (sequence !== playbackSequence) return

    activeObjectUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(activeObjectUrl)
    activeAudio = audio

    await new Promise<void>((resolve) => {
      let settled = false
      const settle = () => {
        if (settled) return
        settled = true
        if (settlePlayback === settle) settlePlayback = null
        if (sequence === playbackSequence) clearPlayback()
        resolve()
      }
      settlePlayback = settle
      audio.onended = settle
      audio.onerror = settle
      isPlaying.value = true
      void audio.play().catch((error: unknown) => {
        console.warn('[useAudioPlayer] Typecast 음성 재생에 실패했습니다.', error)
        settle()
      })
    })
  } catch (error) {
    if (sequence === playbackSequence) clearPlayback()
    console.warn('[useAudioPlayer] 백엔드 TTS 음성 생성에 실패했습니다.', error)
  }
}

const playLetterSound = (letter: string): Promise<void> => speak(letter, 0.7)

const playSequence = async (items: string[], rate = 0.85): Promise<void> => {
  for (const item of items) await speak(item, rate)
}

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
