<script setup lang="ts">
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
    surface?: 'standard' | 'choice'
  }>(),
  {
    type: 'consonant',
    state: 'default',
    selectable: false,
    size: 'medium',
    surface: 'standard',
  },
)

const emit = defineEmits<{ select: [jamo: string] }>()

const cardUrl = computed(() => getHangulCardUrl(props.jamo))
const hasAsset = computed(() => cardUrl.value !== null)
const typeLabel = computed(() => (props.type === 'consonant' ? '자음' : '모음'))

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
    :class="[
      `letter-card--${size}`,
      `letter-card--${state}`,
      `letter-card--${surface}`,
      { 'is-selectable': selectable },
    ]"
    :role="selectable ? 'button' : 'img'"
    :tabindex="selectable && state !== 'disabled' ? 0 : undefined"
    :aria-label="`${typeLabel} ${jamo}`"
    :aria-pressed="selectable && state === 'selected' ? true : undefined"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <span v-if="surface === 'choice'" class="letter-glyph" aria-hidden="true">{{ jamo }}</span>
    <ResourceRequired
      v-else-if="!hasAsset"
      :label="`${jamo} ${typeLabel} 카드 PNG`"
      size="small"
    />
    <img
      v-else
      class="letter-image"
      :src="cardUrl ?? ''"
      :alt="`${typeLabel} ${jamo}`"
      draggable="false"
    />
  </div>
</template>

<style scoped src="@/styles/training/LetterCard.css"></style>
