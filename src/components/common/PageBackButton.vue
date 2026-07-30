<script setup lang="ts">
import backIcon from '@/assets/icons/arrow-back.svg'

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
    <img :src="backIcon" alt="" aria-hidden="true" />
  </button>
</template>

<style scoped src="@/styles/common/PageBackButton.css"></style>
