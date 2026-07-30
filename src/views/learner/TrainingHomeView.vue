<script setup lang="ts">
// 아동용 기본 화면은 서버가 내려줄 순차 커리큘럼을 지그재그 경로로 표시합니다.
// 현재는 플레이 가능한 소분류 10개와 진행 상태를 목업으로 구성합니다.
// 우측 상단 디버그 버튼으로 기존 전체 훈련 선택 화면도 확인할 수 있습니다.

import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAllCategories, getCategoryById } from '@/mocks/trainingLookup'
import TrainingCategoryCard from '@/components/training/TrainingCategoryCard.vue'
import TrainingCurriculumPath, {
  type CurriculumPathStep,
} from '@/components/training/TrainingCurriculumPath.vue'
import TrainingLessonModal from '@/components/training/TrainingLessonModal.vue'
import { useDailyCurriculum } from '@/composables/useDailyCurriculum'
import { learnerDataSource } from '@/config/learnerDataSource'

const route = useRoute()
const router = useRouter()

const categories = getAllCategories()
const showAllTrainings = ref(false)
const dailyCurriculum = useDailyCurriculum()

void dailyCurriculum.reloadCurrentCurriculum().catch(() => undefined)

watchEffect(() => {
  if (dailyCurriculum.isTodayComplete.value) {
    void router.replace({ name: 'training-today-complete' })
  }
})

const curriculumSteps = computed<CurriculumPathStep[]>(() =>
  dailyCurriculum.curriculumItems.map((step) => ({
    ...step,
    status: step.status === 'COMPLETED'
      ? 'complete'
      : step.status === 'CURRENT'
        ? 'current'
        : 'locked',
  })),
)

// 라우트 파라미터로 선택된 카테고리(없으면 목록 상태)
const activeCategoryId = computed(() => {
  const raw = route.params.categoryId
  return typeof raw === 'string' ? raw : ''
})
const activeCategory = computed(() =>
  activeCategoryId.value ? getCategoryById(activeCategoryId.value) : null,
)
const isModalOpen = computed(() => activeCategory.value !== null)
const handleCategorySelect = (categoryId: string) => {
  // 대분류 선택 → 해당 카테고리 서브메뉴 모달(라우트 이동)
  void router.push({ name: 'training-category', params: { categoryId } })
}

const handleCurriculumSelect = (step: CurriculumPathStep) => {
  void router.push({
    name: 'training-lesson',
    params: { categoryId: step.categoryId, lessonId: step.lesson.id },
    query: { trainingId: step.trainingId },
  })
}

const handleLockedSelect = () => undefined

const handleLessonSelect = (lessonId: string) => {
  if (!activeCategoryId.value) return
  // 준비된 레슨 선택 → 레슨 화면(인트로)으로 이동
  void router.push({
    name: 'training-lesson',
    params: { categoryId: activeCategoryId.value, lessonId },
  })
}

const handleCloseModal = () => {
  void router.push({ name: 'training-home' })
}

</script>

<template>
  <main class="training-home">
    <button
      v-if="learnerDataSource === 'mock'"
      class="debug-view-button"
      type="button"
      :aria-pressed="showAllTrainings"
      @click="showAllTrainings = !showAllTrainings"
    >
      {{ showAllTrainings ? '커리큘럼 보기' : '전체 훈련 보기' }}
    </button>

    <section
      v-if="!showAllTrainings && dailyCurriculum.curriculumStatus.value === 'preparing'"
      class="curriculum-state"
      aria-live="polite"
    >
      <span class="state-loader" aria-hidden="true"><i/><i/><i/></span>
      <h1>오늘 학습을 준비하고 있어!</h1>
    </section>

    <section
      v-else-if="!showAllTrainings && dailyCurriculum.curriculumStatus.value === 'rest'"
      class="curriculum-state"
    >
      <h1>오늘은 쉬는 날이야!</h1>
    </section>

    <TrainingCurriculumPath
      v-else-if="!showAllTrainings"
      :steps="curriculumSteps"
      :study-date="dailyCurriculum.studyDate.value"
      @select="handleCurriculumSelect"
      @locked="handleLockedSelect"
    />

    <section v-else class="home-content">
      <header class="home-heading">
        <h1 class="home-title">어떤 훈련을 해볼까요?</h1>
        <p class="home-subtitle">하고 싶은 훈련을 골라보세요.</p>
      </header>

      <div class="category-grid">
        <TrainingCategoryCard
          v-for="category in categories"
          :key="category.id"
          :category="category"
          @select="handleCategorySelect"
        />
      </div>
    </section>

    <TrainingLessonModal
      :open="isModalOpen"
      :category="activeCategory"
      @select="handleLessonSelect"
      @close="handleCloseModal"
    />

  </main>
</template>

<style scoped src="@/styles/training/TrainingHomeView.css"></style>
