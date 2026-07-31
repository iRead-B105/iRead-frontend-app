<script setup lang="ts">
import nextActiveImage from '@/assets/training/navigation/learning-next-active.webp'
import nextDisabledImage from '@/assets/training/navigation/learning-next-disabled.webp'

defineProps<{ enabled: boolean }>()
defineEmits<{ activate: [] }>()
</script>

<template>
  <button
    class="learning-next-button"
    :class="{ 'learning-next-button--enabled': enabled }"
    type="button"
    :disabled="!enabled"
    aria-label="다음 문제로 이동"
    @click="$emit('activate')"
  >
    <img
      :src="enabled ? nextActiveImage : nextDisabledImage"
      alt=""
      aria-hidden="true"
    />
  </button>
</template>

<style scoped src="@/styles/training/LearningNextButton.css"></style>
