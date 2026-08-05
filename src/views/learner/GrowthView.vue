<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import gardenBackground from '../../assets/backgrounds/garden-growth/garden-stage-1-soil.png'
import checkIcon from '@/assets/icons/check.svg'
import growthSummaryBoard from '@/assets/growth/ui/growth-summary-board.webp'
import phonicsProgressCard from '@/assets/growth/ui/growth-progress-card-phonics.webp'
import readingProgressCard from '@/assets/growth/ui/growth-progress-card-reading.webp'
import fluencyProgressCard from '@/assets/growth/ui/growth-progress-card-fluency.webp'
import {
  fetchCurrentCurriculum,
  fetchGrowthAreas,
  fetchStoryLibrary,
  fetchStoryFriends,
  getCachedStudent,
} from '@/services/learnerDataRepository'
import StoryFriendCollectionModal from '@/components/growth/StoryFriendCollectionModal.vue'
import type {
  LearnerCurrentCurriculum,
  LearnerStoryLibrary,
} from '@/features/learner/model'
import type { VillageItem } from '@/types/village'

type GardenId = 1 | 2 | 3

interface Garden {
  id: GardenId
  title: string
  categoryIds: string[]
  progressCard: string
}

const gardens = reactive<Garden[]>([
  {
    id: 1,
    title: '파닉스',
    categoryIds: ['phonological-awareness', 'phonics'],
    progressCard: phonicsProgressCard,
  },
  {
    id: 2,
    title: '읽기',
    categoryIds: ['short-text'],
    progressCard: readingProgressCard,
  },
  {
    id: 3,
    title: '유창성',
    categoryIds: ['fluency'],
    progressCard: fluencyProgressCard,
  },
])
const route = useRoute()

const stageNames = ['흙', '새싹', '꽃봉', '꽃', '만개'] as const
// TODO: 백엔드가 영역별 다음 단계 필요 학습량을 제공하면 고정 임계값을 교체합니다.
const learningCounts = reactive<Record<GardenId, number>>({ 1: 0, 2: 0, 3: 0 })
const stages = reactive<Record<GardenId, number>>({ 1: 1, 2: 1, 3: 1 })
const currentCurriculum = ref<LearnerCurrentCurriculum | null>(null)
const storyLibrary = ref<LearnerStoryLibrary | null>(null)
const studyDay = ref(1)
const lessonsPerGrowthStage = 5
// TODO: 백엔드에 학습 일차가 추가되면 누적 성장 횟수 기반 임시 계산을 교체합니다.
const trainingGoalComplete = computed(() => {
  const curriculum = currentCurriculum.value
  return Boolean(
    curriculum &&
    (
      curriculum.status === 'COMPLETED' ||
      curriculum.trainings.every((training) => training.status === 'COMPLETED')
    )
  )
})
// TODO: 백엔드가 일별 이야기 완료 여부를 제공하면 오늘 날짜 기준으로 교체합니다.
const storyGoalComplete = computed(() =>
  storyLibrary.value?.stories.some((story) => story.status === 'COMPLETED') ?? false,
)
const progressFor = (garden: Garden) => {
  if (stages[garden.id] >= 5) return 100
  const completedInStage =
    learningCounts[garden.id] - (stages[garden.id] - 1) * lessonsPerGrowthStage
  return Math.min(100, Math.max(0, completedInStage * (100 / lessonsPerGrowthStage)))
}
const growingGarden = ref<GardenId | null>(null)
const hoveredGarden = ref<GardenId | null>(null)
const announcement = ref('화단을 눌러 꽃을 키워봐!')
const storyFriendsOpen = ref(false)
const storyFriends = ref<VillageItem[]>([])
const placedFriendIds = ref<string[]>([])
const activeFriendId = ref<string | null>(null)
const friendAnnouncement = ref('')
const loadError = ref('')
const friendsLoadError = ref('')
let growthTimer: ReturnType<typeof setTimeout> | undefined
let friendTimer: ReturnType<typeof setTimeout> | undefined

const activeStudentId = (() => {
  return getCachedStudent().studentId
})()
const seenStagesKey = `iread-growth-seen-stages:${activeStudentId}`
const placedFriendsKey = `iread-growth-story-friends:${activeStudentId}`
const maxPlacedFriends = 4

const placedFriends = computed(() =>
  placedFriendIds.value
    .map((friendId) => storyFriends.value.find((friend) => friend.id === friendId))
    .filter((friend): friend is VillageItem => Boolean(friend?.unlocked))
    .slice(0, maxPlacedFriends),
)

const loadPlacedFriendIds = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(placedFriendsKey) ?? '[]')
    return Array.isArray(saved)
      ? saved.filter((value): value is string => typeof value === 'string').slice(0, maxPlacedFriends)
      : []
  } catch {
    return []
  }
}

const savePlacedFriendIds = () => {
  localStorage.setItem(placedFriendsKey, JSON.stringify(placedFriendIds.value))
}

const placeFriend = (friendId: string) => {
  const friend = storyFriends.value.find((item) => item.id === friendId && item.unlocked)
  if (!friend || placedFriendIds.value.includes(friendId)) return
  if (placedFriendIds.value.length >= maxPlacedFriends) {
    friendAnnouncement.value = '정원에는 친구 네 명까지 함께할 수 있어!'
    return
  }
  placedFriendIds.value = [...placedFriendIds.value, friendId]
  savePlacedFriendIds()
  friendAnnouncement.value = `${friend.name}가 정원에 놀러 왔어!`
}

const toggleFriendPlacement = (friendId: string) => {
  if (placedFriendIds.value.includes(friendId)) {
    placedFriendIds.value = placedFriendIds.value.filter((id) => id !== friendId)
    savePlacedFriendIds()
    return
  }
  placeFriend(friendId)
}

const greetFriend = (friend: VillageItem) => {
  activeFriendId.value = friend.id
  friendAnnouncement.value = friend.storyTitle
    ? `${friend.storyTitle} 이야기를 들려줘서 고마워!`
    : '멋진 이야기를 들려줘서 고마워!'
  window.clearTimeout(friendTimer)
  friendTimer = window.setTimeout(() => {
    activeFriendId.value = null
    friendTimer = undefined
  }, 3200)
}

const loadSeenStages = (): Record<GardenId, number> => {
  try {
    const saved = JSON.parse(localStorage.getItem(seenStagesKey) ?? '{}') as Partial<Record<GardenId, number>>
    return { 1: saved[1] ?? 1, 2: saved[2] ?? 1, 3: saved[3] ?? 1 }
  } catch {
    return { 1: 1, 2: 1, 3: 1 }
  }
}

const saveSeenStages = () => {
  localStorage.setItem(seenStagesKey, JSON.stringify(stages))
}

const gardenImageLoaders = import.meta.glob<string>(
  '../../assets/backgrounds/garden-growth/[123]*.png',
  { import: 'default' },
)
const gardenImageUrls = reactive<Record<string, string>>({})

const gardenImageKey = (garden: Garden) => {
  const stageName = stageNames[stages[garden.id] - 1]
  return `../../assets/backgrounds/garden-growth/${garden.id}${stageName}.png`
}

const imageFor = (garden: Garden) => {
  return gardenImageUrls[gardenImageKey(garden)] ?? gardenBackground
}

const loadGardenImage = async (garden: Garden) => {
  const key = gardenImageKey(garden)
  if (gardenImageUrls[key]) return
  const loader = gardenImageLoaders[key]
  if (loader) gardenImageUrls[key] = await loader()
}

const progressLabel = (garden: Garden) => (
  stages[garden.id] === 5 ? '만개' : `${stages[garden.id]}단계`
)

// 성장 단계는 서버 데이터로만 표시한다(클릭 성장 치트는 mock 모드와 함께 제거).
const grow = (_garden: Garden) => {}

onMounted(async () => {
  placedFriendIds.value = loadPlacedFriendIds()

  const [growthResult, friendsResult, curriculumResult, storyResult] = await Promise.allSettled([
    fetchGrowthAreas(),
    fetchStoryFriends(),
    fetchCurrentCurriculum(),
    fetchStoryLibrary(),
  ])

  if (growthResult.status === 'fulfilled') {
    const growthAreas = growthResult.value
    growthAreas.forEach((area) => {
      learningCounts[area.areaId] = area.learningCount
      stages[area.areaId] = Math.min(5, Math.max(1, area.stage))
      const garden = gardens.find((item) => item.id === area.areaId)
      if (garden) garden.title = area.name
    })
    studyDay.value = Math.max(
      1,
      Object.values(learningCounts).reduce((total, count) => total + count, 0) + 1,
    )
  } else {
    const error = growthResult.reason
    loadError.value =
      error instanceof Error
        ? error.message
        : '성장 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
  }

  if (friendsResult.status === 'fulfilled') {
    storyFriends.value = [...friendsResult.value]
    placedFriendIds.value = placedFriendIds.value.filter((friendId) =>
      storyFriends.value.some((friend) => friend.id === friendId && friend.unlocked),
    )
    const requestedFriendId = typeof route.query.placeFriend === 'string'
      ? route.query.placeFriend
      : ''
    if (requestedFriendId) placeFriend(requestedFriendId)
  } else {
    const error = friendsResult.reason
    friendsLoadError.value =
      error instanceof Error ? error.message : '이야기 친구를 불러오지 못했어.'
  }

  if (curriculumResult.status === 'fulfilled') {
    currentCurriculum.value = curriculumResult.value
  }

  if (storyResult.status === 'fulfilled') {
    storyLibrary.value = storyResult.value
  }

  await Promise.all(gardens.map(loadGardenImage))

  const seenStages = loadSeenStages()
  const newlyGrown = gardens.find((garden) => stages[garden.id] > seenStages[garden.id])
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
  window.clearTimeout(friendTimer)
})
</script>

<template>
  <main class="growth-page">
    <section class="garden-scene" aria-labelledby="growth-title">
      <h1 id="growth-title" class="sr-only">나의 성장</h1>

      <img class="garden-background" :src="gardenBackground" alt="" />

      <aside
        class="growth-summary-panel"
        aria-label="학습 요약"
        :style="{ backgroundImage: `url(${growthSummaryBoard})` }"
      >
        <p class="growth-study-day">
          <span>학습</span>
          <strong>{{ studyDay }}</strong>
          <span>일차</span>
        </p>
        <h2>오늘의 목표</h2>
        <ul class="growth-goal-list">
          <li :class="{ 'growth-goal--complete': trainingGoalComplete }">
            <span>훈련</span>
            <span class="growth-goal-status">
              <img :src="checkIcon" alt="" aria-hidden="true" />
              {{ trainingGoalComplete ? '완료' : '아직' }}
            </span>
          </li>
          <li :class="{ 'growth-goal--complete': storyGoalComplete }">
            <span>이야기 읽기</span>
            <span class="growth-goal-status">
              <img :src="checkIcon" alt="" aria-hidden="true" />
              {{ storyGoalComplete ? '완료' : '아직' }}
            </span>
          </li>
        </ul>
      </aside>

      <button
        class="growth-friends-button"
        type="button"
        aria-haspopup="dialog"
        :aria-expanded="storyFriendsOpen"
        @click="storyFriendsOpen = true"
      >
        이야기 친구들
      </button>

      <div class="garden-friends" aria-label="정원에 놓은 이야기 친구">
        <button
          v-for="(friend, index) in placedFriends"
          :key="friend.id"
          class="garden-friend"
          :class="[
            `garden-friend--${index + 1}`,
            { 'garden-friend--talking': activeFriendId === friend.id },
          ]"
          type="button"
          :aria-label="`${friend.name}. 눌러서 인사 듣기`"
          @click="greetFriend(friend)"
        >
          <img :src="friend.image" :alt="friend.name" />
          <span v-if="activeFriendId === friend.id" class="garden-friend-bubble">
            {{ friendAnnouncement }}
          </span>
        </button>
      </div>

      <img
        v-for="garden in gardens"
        :key="`${garden.id}-${stages[garden.id]}`"
        class="garden-layer"
        :class="[
          `garden-layer--${garden.id}`,
          {
            'garden-layer--growing': growingGarden === garden.id,
            'garden-layer--hovered': hoveredGarden === garden.id,
            'garden-layer--complete': progressFor(garden) === 100,
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
          : `${garden.title} 화단 ${progressLabel(garden)}. 진행 ${progressFor(garden)}퍼센트`"
        @pointerenter="showGrowHint(garden)"
        @pointerleave="showGardenHint(garden)"
        @focus="showGrowHint(garden)"
        @blur="showGardenHint(garden)"
        @click="grow(garden)"
      >
        <span
          class="garden-progress-card"
          :class="{ 'garden-progress-card--complete': progressFor(garden) === 100 }"
          :style="{ backgroundImage: `url(${garden.progressCard})` }"
        >
          <strong>{{ garden.title }}</strong>
          <span
            class="garden-progress-track"
            role="progressbar"
            :aria-label="`${garden.title} 성장 진행도`"
            :aria-valuenow="progressFor(garden)"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <i :style="{ width: `${progressFor(garden)}%` }"></i>
          </span>
        </span>
      </button>

      <p class="sr-only" aria-live="polite">{{ announcement }}</p>
      <p class="sr-only" aria-live="polite">{{ friendAnnouncement }}</p>
    </section>

    <StoryFriendCollectionModal
      v-if="storyFriendsOpen"
      :friends="storyFriends"
      :placed-friend-ids="placedFriendIds"
      :load-error="friendsLoadError"
      :max-placed="maxPlacedFriends"
      @toggle-placement="toggleFriendPlacement"
      @close="storyFriendsOpen = false"
    />
  </main>
</template>

<style scoped src="@/styles/world/GrowthView.css"></style>
