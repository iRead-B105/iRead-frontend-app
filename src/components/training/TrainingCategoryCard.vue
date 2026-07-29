<script setup lang="ts">
import { computed } from 'vue'
import type { TrainingCategory } from '@/types/training'

defineProps<{
  category: TrainingCategory
}>()

const emit = defineEmits<{
  select: [categoryId: TrainingCategory['id']]
}>()

const isSelected = computed(() => false) // 확장 가능
</script>

<template>
  <button
    class="category-card"
    :class="{ 'is-selected': isSelected }"
    @click="emit('select', category.id)"
  >
    <div class="card-content">
      <h3 class="card-title">{{ category.title }}</h3>
      <p class="card-description">{{ category.description }}</p>
    </div>
  </button>
</template>

<style scoped src="@/styles/training/TrainingCategoryCard.css"></style>
