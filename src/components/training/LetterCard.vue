<script setup lang="ts">
// 한글 자모 카드 컴포넌트
// 기존 한글 카드 에셋(src/assets/cards/hangul)을 사용합니다.
// 해당 자모의 카드가 없으면 리소스 추가 필요 자리로 표시합니다.

import { computed } from 'vue'
import { getHangulCardUrl } from '@/data/hangulCards'
import ResourceRequired from './ResourceRequired.vue'

const props = withDefaults(
  defineProps<{
    jamo: string
    type?: 'consonant' | 'vowel'
    state?: 'default' | 'selected' | 'correct' | 'wrong' | 'hint' | 'disabled'
    selectable?: boolean
    size?: 'small' | 'medium' | 'large'
  }>(),
  {
    type: 'consonant',
    state: 'default',
    selectable: false,
    size: 'medium',
  },
)

const emit = defineEmits<{ select: [jamo: string] }>()

const cardUrl = computed(() => getHangulCardUrl(props.jamo))
const hasAsset = computed(() => cardUrl.value !== null)

const handleClick = () => {
  if (!props.selectable || props.state === 'disabled' || props.state === 'correct') return
  emit('select', props.jamo)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.selectable) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    handleClick()
  }
}
</script>

<template>
  <div
    class="letter-card"
    :class="[`letter-card--${size}`, `letter-card--${state}`, { 'is-selectable': selectable }]"
    :role="selectable ? 'button' : 'img'"
    :tabindex="selectable && state !== 'disabled' ? 0 : undefined"
    :aria-label="`${type === 'consonant' ? '자음' : '모음'} ${jamo}`"
    :aria-pressed="selectable && state === 'selected' ? true : undefined"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <ResourceRequired v-if="!hasAsset" :label="`${jamo} ${type === 'consonant' ? '자음' : '모음'} 카드 PNG`" size="small" />
    <img v-else class="letter-image" :src="cardUrl ?? ''" :alt="`${type === 'consonant' ? '자음' : '모음'} ${jamo}`" draggable="false" />
  </div>
</template>

<style scoped src="@/styles/training/LetterCard.css"></style>
