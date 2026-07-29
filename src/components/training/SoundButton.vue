<script setup lang="ts">
// 소리 듣기 버튼
// useAudioPlayer(목업 TTS)로 텍스트를 재생합니다.
// 중복 재생 방지: 같은 문장이 이미 재생 중이면 다시 시작하지 않습니다.

import { computed, ref } from 'vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

const props = withDefaults(
  defineProps<{
    text: string // 재생할 문장/단어
    label?: string // 버튼 아래 안내 문구
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

const { isPlaying, currentText, replay } = useAudioPlayer()
const hasPlayed = ref(false)

const isThisPlaying = computed(
  () => isPlaying.value && currentText.value === props.text,
)

const handlePlay = async () => {
  if (props.disabled || isThisPlaying.value) return
  await replay(props.text, props.rate)
  hasPlayed.value = true
  emit('played')
}

const displayLabel = computed(() => {
  if (isThisPlaying.value) return '재생 중'
  return hasPlayed.value ? '다시 듣기' : '소리 듣기'
})
</script>

<template>
  <button
    class="sound-button"
    :class="[`sound-button--${size}`, `sound-button--${variant}`, { playing: isThisPlaying }]"
    type="button"
    :disabled="disabled || isThisPlaying"
    :aria-label="label ? `${displayLabel}: ${label}` : displayLabel"
    @click="handlePlay"
  >
    <span class="sound-pulse" aria-hidden="true"></span>
    <svg class="sound-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M11 12v8M7 12v8M15 9l6-2v18l-6-2M23 11a6 6 0 010 10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span class="sound-label">{{ displayLabel }}</span>
  </button>
</template>

<style scoped src="@/styles/training/SoundButton.css"></style>
