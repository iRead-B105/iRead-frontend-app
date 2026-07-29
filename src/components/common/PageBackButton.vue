<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
  }>(),
  {
    label: '이전 화면으로 돌아가기',
  },
)

const emit = defineEmits<{ back: [] }>()
</script>

<template>
  <button class="page-back-button" type="button" :aria-label="label" @click="emit('back')">
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M30 36L18 24l12-12"
        fill="none"
        stroke="currentColor"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</template>

<style scoped src="@/styles/common/PageBackButton.css"></style>
