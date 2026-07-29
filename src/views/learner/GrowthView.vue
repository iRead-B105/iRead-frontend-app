<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import gardenBackground from '../../assets/backgrounds/garden-growth/garden-stage-1-soil.png'
import flowerBedNameplate from '../../assets/growth/ui/flower-bed-nameplate.png'
import { fetchGrowthAreas, getCachedStudent } from '@/services/learnerDataRepository'
import StoryFriendCollectionModal from '@/components/growth/StoryFriendCollectionModal.vue'
import { learnerDataSource } from '@/config/learnerDataSource'

type GardenId = 1 | 2 | 3

interface Garden {
  id: GardenId
  title: string
  categoryIds: string[]
}

const gardens = reactive<Garden[]>([
  {
    id: 1,
    title: '파닉스',
    categoryIds: ['phonological-awareness', 'phonics'],
  },
  { id: 2, title: '읽기', categoryIds: ['short-text'] },
  { id: 3, title: '유창성', categoryIds: ['fluency'] },
])

const stageNames = ['흙', '새싹', '꽃봉', '꽃', '만개'] as const
// API 모드에서는 Backend 성장 정책을 사용하고, mock 모드에서는 클릭으로 단계를 확인합니다.
const learningCounts = reactive<Record<GardenId, number>>({ 1: 0, 2: 0, 3: 0 })
const backendStages = reactive<Record<GardenId, number>>({ 1: 1, 2: 1, 3: 1 })
const stageForLearningCount = (count: number) => Math.min(5, Math.max(1, count + 1))
const stages = computed<Record<GardenId, number>>(() => ({
  // API 모드에서는 노력·다양성·숙달도를 종합한 Backend의 단계가 기준 원본이다.
  // mock 모드의 클릭 성장만 기존 단순 카운트 계산을 유지한다.
  1: learnerDataSource === 'api' ? backendStages[1] : stageForLearningCount(learningCounts[1]),
  2: learnerDataSource === 'api' ? backendStages[2] : stageForLearningCount(learningCounts[2]),
  3: learnerDataSource === 'api' ? backendStages[3] : stageForLearningCount(learningCounts[3]),
}))
const growingGarden = ref<GardenId | null>(null)
const hoveredGarden = ref<GardenId | null>(null)
const announcement = ref('화단을 눌러 꽃을 키워 보세요.')
const storyFriendsOpen = ref(false)
const loadError = ref('')
let growthTimer: ReturnType<typeof setTimeout> | undefined

const activeStudentId = (() => {
  return getCachedStudent().studentId
})()
const seenStagesKey = `iread-growth-seen-stages:${activeStudentId}`

const loadSeenStages = (): Record<GardenId, number> => {
  try {
    const saved = JSON.parse(localStorage.getItem(seenStagesKey) ?? '{}') as Partial<Record<GardenId, number>>
    return { 1: saved[1] ?? 1, 2: saved[2] ?? 1, 3: saved[3] ?? 1 }
  } catch {
    return { 1: 1, 2: 1, 3: 1 }
  }
}

const saveSeenStages = () => {
  localStorage.setItem(seenStagesKey, JSON.stringify(stages.value))
}

const gardenImages = import.meta.glob<string>(
  '../../assets/backgrounds/garden-growth/[123]*.png',
  { eager: true, import: 'default' },
)

const imageFor = (garden: Garden) => {
  const stageName = stageNames[stages.value[garden.id] - 1]
  return gardenImages[
    `../../assets/backgrounds/garden-growth/${garden.id}${stageName}.png`
  ] ?? ''
}

const progressLabel = (garden: Garden) => (
  stages.value[garden.id] === 5 ? '만개' : `${stages.value[garden.id]}단계`
)

const grow = (garden: Garden) => {
  if (loadError.value || learnerDataSource === 'api') return

  const currentStage = stages.value[garden.id]
  if (currentStage < 5) {
    learningCounts[garden.id] += 1
  }

  growingGarden.value = garden.id
  window.setTimeout(() => {
    if (growingGarden.value === garden.id) growingGarden.value = null
  }, 520)

  announcement.value = stages.value[garden.id] === 5
    ? `${garden.title} 화단이 활짝 피었어요!`
    : `${garden.title} 화단이 ${stages.value[garden.id]}단계로 자랐어요!`

  window.clearTimeout(growthTimer)
  growthTimer = window.setTimeout(() => {
    saveSeenStages()
    growthTimer = undefined
  }, 1200)
}

onMounted(async () => {
  try {
    const growthAreas = await fetchGrowthAreas()
    growthAreas.forEach((area) => {
      learningCounts[area.areaId] = area.learningCount
      backendStages[area.areaId] = Math.min(5, Math.max(1, area.stage))
      const garden = gardens.find((item) => item.id === area.areaId)
      if (garden) garden.title = area.name
    })
  } catch (error) {
    loadError.value =
      error instanceof Error
        ? error.message
        : '성장 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
  }

  const seenStages = loadSeenStages()
  const newlyGrown = gardens.find((garden) => stages.value[garden.id] > seenStages[garden.id])
  if (!newlyGrown) {
    saveSeenStages()
    return
  }

  growingGarden.value = newlyGrown.id
  growthTimer = window.setTimeout(() => {
    growingGarden.value = null
    saveSeenStages()
    growthTimer = undefined
  }, 1200)
})

const showGrowHint = (garden: Garden) => {
  hoveredGarden.value = garden.id
}

const showGardenHint = (garden: Garden) => {
  if (hoveredGarden.value === garden.id) hoveredGarden.value = null
}

onBeforeUnmount(() => {
  window.clearTimeout(growthTimer)
})
</script>

<template>
  <main class="growth-page">
    <section class="garden-scene" aria-labelledby="growth-title">
      <h1 id="growth-title" class="sr-only">나의 성장</h1>

      <img class="garden-background" :src="gardenBackground" alt="" />

      <button
        class="growth-friends-button"
        type="button"
        aria-haspopup="dialog"
        :aria-expanded="storyFriendsOpen"
        @click="storyFriendsOpen = true"
      >
        이야기 친구들
      </button>

      <img
        v-for="garden in gardens"
        :key="`${garden.id}-${stages[garden.id]}`"
        class="garden-layer"
        :class="[
          `garden-layer--${garden.id}`,
          {
            'garden-layer--growing': growingGarden === garden.id,
            'garden-layer--hovered': hoveredGarden === garden.id,
          },
        ]"
        :src="imageFor(garden)"
        alt=""
      />

      <button
        v-for="garden in gardens"
        :key="garden.id"
        class="garden-button"
        :class="`garden-button--${garden.id}`"
        type="button"
        :disabled="Boolean(loadError)"
        :aria-label="loadError
          ? `${garden.title} 화단. 성장 정보 계약 확인 필요`
          : learnerDataSource === 'api'
            ? `${garden.title} 화단 ${progressLabel(garden)}`
            : `${garden.title} 화단 ${progressLabel(garden)}. 눌러서 성장시키기`"
        @pointerenter="showGrowHint(garden)"
        @pointerleave="showGardenHint(garden)"
        @focus="showGrowHint(garden)"
        @blur="showGardenHint(garden)"
        @click="grow(garden)"
      >
        <span class="garden-title">
          <img :src="flowerBedNameplate" alt="" aria-hidden="true" />
          <strong>{{ garden.title }}</strong>
        </span>
      </button>

      <p class="sr-only" aria-live="polite">{{ announcement }}</p>
    </section>

    <StoryFriendCollectionModal v-if="storyFriendsOpen" @close="storyFriendsOpen = false" />
  </main>
</template>

<style scoped src="@/styles/world/GrowthView.css"></style>
