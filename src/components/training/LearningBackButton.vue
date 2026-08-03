<script setup lang="ts">
import backImage from '@/assets/training/navigation/learning-back.webp'

defineEmits<{ back: [] }>()
</script>

<template>
  <button
    class="learning-back-button"
    type="button"
    aria-label="학습을 그만하고 훈련 선택으로 돌아가기"
    @click="$emit('back')"
  >
    <img :src="backImage" alt="" aria-hidden="true" />
  </button>
</template>

<style scoped src="@/styles/training/LearningBackButton.css"></style>
