<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import type { VillageItem } from '@/types/village'
import closeIcon from '@/assets/icons/close.svg'

const props = withDefaults(defineProps<{
  friends: VillageItem[]
  placedFriendIds: string[]
  loadError?: string
  maxPlaced?: number
}>(), {
  loadError: '',
  maxPlaced: 4,
})

const emit = defineEmits<{
  close: []
  togglePlacement: [friendId: string]
}>()

const acquiredFriends = computed(() => props.friends.filter((friend) => friend.unlocked))
const gardenIsFull = computed(() => props.placedFriendIds.length >= props.maxPlaced)
const isPlaced = (friendId: string) => props.placedFriendIds.includes(friendId)

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') emit('close')
}

onMounted(async () => {
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
            <img :src="closeIcon" alt="" aria-hidden="true" />
          </button>
        </header>

        <div v-if="acquiredFriends.length" class="collection-grid">
          <article v-for="friend in acquiredFriends" :key="friend.id" class="collection-card">
            <div class="collection-picture">
              <img :src="friend.image" :alt="friend.name" loading="lazy" decoding="async" />
            </div>
            <strong>{{ friend.name }}</strong>
            <p>{{ friend.storyTitle }}</p>
            <button
              class="collection-placement"
              type="button"
              :class="{ 'collection-placement--active': isPlaced(friend.id) }"
              :disabled="gardenIsFull && !isPlaced(friend.id)"
              @click="emit('togglePlacement', friend.id)"
            >
              {{ isPlaced(friend.id) ? '정원에서 쉬기' : '정원에 놓기' }}
            </button>
          </article>
        </div>

        <div v-else class="collection-empty">
          <strong>{{ props.loadError || '아직 만난 친구가 없어요!' }}</strong>
          <p v-if="!props.loadError">이야기를 읽어서 친구를 모아봐!</p>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped src="@/styles/world/StoryFriendCollectionModal.css"></style>
