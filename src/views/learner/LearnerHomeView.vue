<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import IslandMap from '../../components/IslandMap.vue'
import type { MainMapMenuItem } from '../../data/mainMapMenu'
// 메인 섬 페이지 배경: 장식을 덜어낸 고채도 플랫 벡터 배경
import seaBackground from '../../assets/map/main-map-background-flat-waves-v2.png'

const router = useRouter()
const selected = ref<string | null>(null)
const labels: Record<MainMapMenuItem['id'], string> = {
  growth: '나의 성장',
  game: '이야기 나라',
  letter: '글자 연습',
  challenge: '실력 도전',
}

const handleSelect = (id: MainMapMenuItem['id']) => {
  if (id === 'game') {
    router.push({ name: 'story-selection' })
    return
  }
  if (id === 'letter') {
    router.push({ name: 'training-home' })
    return
  }
  if (id === 'growth') {
    router.push({ name: 'growth' })
    return
  }
  if (id === 'challenge') {
    router.push({ name: 'skill-challenge' })
    return
  }
  selected.value = labels[id]
  window.setTimeout(() => { selected.value = null }, 1800)
}
</script>

<template>
  <main class="learner-home" :style="{ backgroundImage: `url(${seaBackground})` }">
    <IslandMap @select="handleSelect" />
    <Transition name="toast">
      <p v-if="selected" class="toast">{{ selected }} 메뉴로 이동할게요!</p>
    </Transition>
  </main>
</template>

<style scoped src="@/styles/world/LearnerHomeView.css"></style>
