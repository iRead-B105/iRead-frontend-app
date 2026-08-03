<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import listenIcon from '@/assets/icons/sound-listen.svg'
import playingIcon from '@/assets/icons/sound-playing.svg'
import replayIcon from '@/assets/icons/sound-replay.svg'

const props = withDefaults(
  defineProps<{
    text: string
    parts?: string[]
    label?: string
    rate?: number
    size?: 'medium' | 'large'
    variant?: 'primary' | 'ghost'
    disabled?: boolean
  }>(),
  {
    label: '',
    rate: 0.9,
    size: 'large',
    variant: 'primary',
    disabled: false,
  },
)

const emit = defineEmits<{ played: [] }>()

const { isPlaying, currentText, replay, playSequence } = useAudioPlayer()
const hasPlayed = ref(false)
const isSequencePlaying = ref(false)

const isThisPlaying = computed(
  () => isSequencePlaying.value || (isPlaying.value && currentText.value === props.text),
)
const isReplayReady = computed(() => hasPlayed.value && !isThisPlaying.value)

const stateLabel = computed(() => {
  if (isThisPlaying.value) return '재생 중'
  return isReplayReady.value ? '다시 듣기' : '소리 듣기'
})

const accessibleLabel = computed(() => (
  props.label ? `${stateLabel.value}: ${props.label}` : stateLabel.value
))
const stateIcon = computed(() => {
  if (isThisPlaying.value) return playingIcon
  return isReplayReady.value ? replayIcon : listenIcon
})

const handlePlay = async () => {
  if (props.disabled || isThisPlaying.value) return
  if (props.parts?.length) {
    isSequencePlaying.value = true
    try {
      await playSequence(props.parts, props.rate)
    } finally {
      isSequencePlaying.value = false
    }
  } else {
    await replay(props.text, props.rate)
  }
  hasPlayed.value = true
  emit('played')
}
</script>

<template>
  <button
    class="sound-button"
    :class="[
      `sound-button--${size}`,
      `sound-button--${variant}`,
      {
        'sound-button--playing': isThisPlaying,
        'sound-button--replay': isReplayReady,
      },
    ]"
    type="button"
    :disabled="disabled || isThisPlaying"
    :aria-label="accessibleLabel"
    :aria-busy="isThisPlaying"
    @click="handlePlay"
  >
    <span class="sound-pulse" aria-hidden="true"></span>
    <img class="sound-icon" :src="stateIcon" alt="" aria-hidden="true" />
  </button>
</template>

<style scoped src="@/styles/training/SoundButton.css"></style>
