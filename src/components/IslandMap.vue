<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import RegionLabel from './RegionLabel.vue'
import { mainMapMenu, type MainMapMenuItem } from '../data/mainMapMenu'
import islandMain from '../assets/map/island-hover-base.png'
import growthMap from '../assets/map/island-hover-growth.png'
import gameMap from '../assets/map/island-hover-story.png'
import letterMap from '../assets/map/island-hover-training.png'
import challengeMap from '../assets/map/island-hover-skill.png'

const emit = defineEmits<{
  select: [id: MainMapMenuItem['id']]
  hover: [id: MainMapMenuItem['id'] | null]
}>()
const activePart = ref<MainMapMenuItem['id'] | null>(null)
const gazeActivePart = ref<MainMapMenuItem['id'] | null>(null)
const parts: Array<{ id: MainMapMenuItem['id']; label: string; src: string }> = [
  { id: 'growth', label: '나의 성장', src: growthMap },
  { id: 'game', label: '이야기 나라', src: gameMap },
  { id: 'letter', label: '글자 연습', src: letterMap },
  { id: 'challenge', label: '실력 도전', src: challengeMap },
]

const setActivePart = (id: MainMapMenuItem['id'] | null) => {
  activePart.value = id
  emit('hover', id)
}

let gazeStaleTimer: number | undefined

function onGaze(event: Event) {
  const detail = (event as CustomEvent<{ clientX?: number; clientY?: number; x?: number; y?: number }>).detail
  const x = typeof detail?.clientX === 'number' ? detail.clientX : detail?.x
  const y = typeof detail?.clientY === 'number' ? detail.clientY : detail?.y
  if (typeof x !== 'number' || typeof y !== 'number') return

  const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('.part-hit')
  const id = hit?.dataset.partId as MainMapMenuItem['id'] | undefined
  gazeActivePart.value = parts.some((part) => part.id === id) ? id ?? null : null
  setActivePart(gazeActivePart.value)

  if (gazeStaleTimer !== undefined) window.clearTimeout(gazeStaleTimer)
  gazeStaleTimer = window.setTimeout(() => {
    gazeActivePart.value = null
    setActivePart(null)
  }, 500)
}

onMounted(() => window.addEventListener('iread:gaze', onGaze))
onBeforeUnmount(() => {
  if (gazeStaleTimer !== undefined) window.clearTimeout(gazeStaleTimer)
  window.removeEventListener('iread:gaze', onGaze)
})
</script>

<template>
  <div class="map-stage">
    <img class="island-main" :src="islandMain" alt="네 가지 학습 지역으로 이루어진 아이리드 섬" />
    <img
      v-for="part in parts"
      v-show="activePart === part.id"
      :key="part.id"
      class="part-image"
      :class="`part-${part.id}`"
      :src="part.src"
      alt=""
    />

    <button
      v-for="part in parts"
      :key="`${part.id}-hit`"
      type="button"
      class="part-hit"
      :class="`hit-${part.id}`"
      :data-part-id="part.id"
      :aria-label="`${part.label} 지역 열기`"
      @pointerenter="setActivePart(part.id)"
      @pointerleave="gazeActivePart ? setActivePart(gazeActivePart) : setActivePart(null)"
      @focus="setActivePart(part.id)"
      @blur="setActivePart(null)"
      @click="emit('select', part.id)"
    ></button>

    <RegionLabel
      v-for="item in mainMapMenu"
      :key="item.id"
      :text="item.label"
      :color="item.color"
      :active="activePart === item.id"
      :class="`${item.id}-label`"
      :style="{ left: item.position.left, top: item.position.top }"
    />
  </div>
</template>

<style scoped src="@/styles/world/IslandMap.css"></style>
