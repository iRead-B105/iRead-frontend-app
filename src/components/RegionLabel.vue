<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  text: string
  color: string
  active?: boolean
}>()

const displayText = computed(() => props.text.replaceAll(' ', '\u2009'))
</script>

<template>
  <div class="region-label" :class="{ 'is-active': active }" :style="{ '--label-color': color }" aria-hidden="true">
    <svg class="region-label-svg" viewBox="0 0 300 96" role="presentation">
      <text class="region-label-text" x="150" y="66" text-anchor="middle">{{ displayText }}</text>
    </svg>
  </div>
</template>

<style scoped src="@/styles/world/RegionLabel.css"></style>
