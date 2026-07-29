<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { VillageItem } from '@/types/village'
import { fetchStoryFriends } from '@/services/learnerDataRepository'

const emit = defineEmits<{ close: [] }>()
const storyFriends = ref<VillageItem[]>([])
const loadError = ref('')
const acquiredFriends = computed(() => storyFriends.value.filter((friend) => friend.unlocked))

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') emit('close')
}

onMounted(async () => {
  try {
    storyFriends.value = [...await fetchStoryFriends()]
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : '이야기 친구를 불러오지 못했어요.'
  }
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="collection-backdrop" @click.self="emit('close')">
      <section class="collection-modal" role="dialog" aria-modal="true" aria-labelledby="collection-title">
        <header class="collection-heading">
          <div>
            <span>우리와 함께한</span>
            <h2 id="collection-title">이야기 친구들</h2>
          </div>
          <button class="collection-close" type="button" aria-label="닫기" @click="emit('close')">
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path d="M8 8l16 16M24 8 8 24" />
            </svg>
          </button>
        </header>

        <div v-if="acquiredFriends.length" class="collection-grid">
          <article v-for="friend in acquiredFriends" :key="friend.id" class="collection-card">
            <div class="collection-picture">
              <img :src="friend.image" :alt="friend.name" />
            </div>
            <strong>{{ friend.name }}</strong>
            <p>{{ friend.storyTitle }}</p>
          </article>
        </div>

        <div v-else class="collection-empty">
          <strong>{{ loadError || '아직 만난 친구가 없어요!' }}</strong>
          <p v-if="!loadError">이야기를 읽어서 친구를 모아봐요!</p>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped src="@/styles/world/StoryFriendCollectionModal.css"></style>
