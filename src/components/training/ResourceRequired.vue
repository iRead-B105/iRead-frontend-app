<script setup lang="ts">
// 리소스 추가 필요 자리 표시 컴포넌트
// 실제 이미지 에셋이 없을 때만 사용합니다.
// 이모지/CSS 일러스트/불필요한 대체 이미지로 채우지 않습니다.
import resourcePlaceholderIcon from '@/assets/icons/resource-placeholder.svg'

withDefaults(
  defineProps<{
    // 필요한 에셋 설명(예: "가방 그림 PNG")
    label?: string
    size?: 'small' | 'medium' | 'large'
  }>(),
  {
    label: '리소스 추가 필요',
    size: 'medium',
  },
)
</script>

<template>
  <!-- 리소스 추가 필요: {{ label }} -->
  <div class="resource-required" :class="`resource-required--${size}`" role="img" :aria-label="`리소스 추가 필요: ${label}`">
    <img class="resource-icon" :src="resourcePlaceholderIcon" alt="" aria-hidden="true" />
    <span class="resource-text">리소스 추가 필요</span>
    <span v-if="label && label !== '리소스 추가 필요'" class="resource-label">{{ label }}</span>
  </div>
</template>

<style scoped src="@/styles/training/ResourceRequired.css"></style>
