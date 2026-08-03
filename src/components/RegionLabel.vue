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
    <span class="region-label-text">{{ displayText }}</span>
  </div>
</template>

<style scoped src="@/styles/world/RegionLabel.css"></style>
