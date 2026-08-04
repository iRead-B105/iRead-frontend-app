<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import IslandMap from '../../components/IslandMap.vue'
import type { MainMapMenuItem } from '../../data/mainMapMenu'
import { useDailyCurriculum } from '@/composables/useDailyCurriculum'
import { learnerDataSource } from '@/config/learnerDataSource'
import { learnerTestRepository } from '@/features/learner/test'
import { getCachedStudent } from '@/services/learnerDataRepository'
import { useLearnerSessionStore } from '@/stores/learnerSession'
// 메인 섬 페이지 배경: 장식을 덜어낸 고채도 플랫 벡터 배경
import seaBackground from '../../assets/map/main-map-background-flat-waves-v2.png'

const router = useRouter()
const dailyCurriculum = useDailyCurriculum()
const learnerSession = useLearnerSessionStore()
const selected = ref<string | null>(null)
// 완료된 메뉴 접근을 막는 안내 모달 ('training' | 'challenge')
const completeNotice = ref<'training' | 'challenge' | null>(null)
const labels: Record<MainMapMenuItem['id'], string> = {
  growth: '나의 성장',
  game: '이야기 나라',
  letter: '글자 연습',
  challenge: '실력 도전',
}

const isTrainingDone = async (): Promise<boolean> => {
  try {
    await dailyCurriculum.loadCurrentCurriculum()
  } catch {
    return false
  }
  return dailyCurriculum.isTodayComplete.value
}

const isChallengeDone = async (): Promise<boolean> => {
  const entry = learnerSession.learningEntry
  if (entry && entry.totalQuestions > 0 && entry.completedQuestions >= entry.totalQuestions) {
    return true
  }
  if (learnerDataSource !== 'api') return false
  try {
    const plan = await learnerTestRepository.getChallengePlan(getCachedStudent().studentId)
    return plan.completed
  } catch {
    return false
  }
}

const handleSelect = async (id: MainMapMenuItem['id']) => {
  if (id === 'game') {
    router.push({ name: 'story-selection' })
    return
  }
  if (id === 'letter') {
    // 오늘 커리큘럼을 모두 마쳤으면 안내 모달로 접근을 막는다
    if (await isTrainingDone()) {
      completeNotice.value = 'training'
      return
    }
    router.push({ name: 'training-home' })
    return
  }
  if (id === 'growth') {
    router.push({ name: 'growth' })
    return
  }
  if (id === 'challenge') {
    if (await isChallengeDone()) {
      completeNotice.value = 'challenge'
      return
    }
    router.push({ name: 'skill-challenge' })
    return
  }
  selected.value = labels[id]
  window.setTimeout(() => { selected.value = null }, 1800)
}

const closeNotice = () => {
  completeNotice.value = null
}
</script>

<template>
  <main class="learner-home" :style="{ backgroundImage: `url(${seaBackground})` }">
    <IslandMap @select="handleSelect" />
    <Transition name="toast">
      <p v-if="selected" class="toast">{{ selected }} 메뉴로 갈게!</p>
    </Transition>
    <Transition name="notice">
      <div
        v-if="completeNotice"
        class="complete-notice-backdrop"
        role="presentation"
        @click.self="closeNotice"
      >
        <section class="complete-notice" role="alertdialog" aria-modal="true">
          <h2>{{ completeNotice === 'training' ? '오늘 훈련은 완료했습니다!' : '실력 도전은 완료했습니다!' }}</h2>
          <p>정말 잘했어요. 다른 섬에서 또 놀아요!</p>
          <div class="complete-notice-actions">
            <button type="button" @click="closeNotice">알겠어요</button>
          </div>
        </section>
      </div>
    </Transition>
  </main>
</template>

<style scoped src="@/styles/world/LearnerHomeView.css"></style>
