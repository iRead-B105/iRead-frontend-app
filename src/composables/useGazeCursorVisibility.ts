import { ref } from 'vue'

export type GazeCursorSize = 'small' | 'medium' | 'large'

const VISIBILITY_STORAGE_KEY = 'iread-gaze-cursor-visibility-v1'
const SIZE_STORAGE_KEY = 'iread-gaze-cursor-size-v1'
const INTERACTION_STORAGE_KEY = 'iread-gaze-button-interaction-v1'
const savedSize = window.localStorage.getItem(SIZE_STORAGE_KEY)
const isCursorVisible = ref(window.localStorage.getItem(VISIBILITY_STORAGE_KEY) !== 'hidden')
const cursorSize = ref<GazeCursorSize>(
  savedSize === 'small' || savedSize === 'large' ? savedSize : 'medium',
)
const isButtonInteractionEnabled = ref(
  window.localStorage.getItem(INTERACTION_STORAGE_KEY) === 'enabled',
)

export function useGazeCursorVisibility() {
  const setCursorVisible = (visible: boolean) => {
    isCursorVisible.value = visible
    window.localStorage.setItem(VISIBILITY_STORAGE_KEY, visible ? 'visible' : 'hidden')
  }

  const toggleCursorVisibility = () => {
    setCursorVisible(!isCursorVisible.value)
  }

  const setCursorSize = (size: GazeCursorSize) => {
    cursorSize.value = size
    window.localStorage.setItem(SIZE_STORAGE_KEY, size)
  }

  const toggleButtonInteraction = () => {
    isButtonInteractionEnabled.value = !isButtonInteractionEnabled.value
    window.localStorage.setItem(
      INTERACTION_STORAGE_KEY,
      isButtonInteractionEnabled.value ? 'enabled' : 'disabled',
    )
  }

  return {
    isCursorVisible,
    cursorSize,
    isButtonInteractionEnabled,
    setCursorVisible,
    toggleCursorVisibility,
    setCursorSize,
    toggleButtonInteraction,
  }
}
