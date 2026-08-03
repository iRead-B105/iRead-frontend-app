<script setup lang="ts">
// 아동용 기본 화면은 서버가 내려줄 순차 커리큘럼을 지그재그 경로로 표시합니다.
// 현재는 플레이 가능한 소분류 10개와 진행 상태를 목업으로 구성합니다.
// 우측 상단 디버그 버튼으로 기존 전체 훈련 선택 화면도 확인할 수 있습니다.

import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAllCategories, getCategoryById } from '@/mocks/trainingLookup'
import { devPreviewLessons } from '@/mocks/trainingLessons'
import TrainingCategoryCard from '@/components/training/TrainingCategoryCard.vue'
import TrainingCurriculumPath, {
  type CurriculumPathStep,
} from '@/components/training/TrainingCurriculumPath.vue'
import TrainingLessonModal from '@/components/training/TrainingLessonModal.vue'
import { useDailyCurriculum } from '@/composables/useDailyCurriculum'

const route = useRoute()
const router = useRouter()

const categories = getAllCategories()
const showAllTrainings = ref(false)
const isDeveloperMode = import.meta.env.DEV
const debugPanelOpen = ref(false)
const dailyCurriculum = useDailyCurriculum()

void dailyCurriculum.reloadCurrentCurriculum().catch(() => undefined)

watchEffect(() => {
  if (!isDeveloperMode && dailyCurriculum.isTodayComplete.value) {
    void router.replace({ name: 'training-today-complete' })
  }
})

const debugLessonGroups = [{
  id: 'activity-previews',
  title: '화면별 미리보기',
  lessons: devPreviewLessons,
}]

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

const retryCurriculum = () => {
  void dailyCurriculum.reloadCurrentCurriculum().catch(() => undefined)
}

const handleLessonSelect = (lessonId: string) => {
  if (!activeCategoryId.value) return
  // 준비된 레슨 선택 → 첫 문제로 바로 이동
  void router.push({
    name: 'training-lesson',
    params: { categoryId: activeCategoryId.value, lessonId },
  })
}

const handleCloseModal = () => {
  void router.push({ name: 'training-home' })
}

const openDebugLesson = (categoryId: string, lessonId: string) => {
  debugPanelOpen.value = false
  void router.push({
    name: 'training-lesson',
    params: { categoryId, lessonId },
    query: { debug: '1' },
  })
}

</script>

<template>
  <main class="training-home">
    <button
      v-if="isDeveloperMode"
      class="debug-view-button"
      type="button"
      aria-haspopup="dialog"
      @click="debugPanelOpen = true"
    >
      DEV
    </button>

    <section
      v-if="!showAllTrainings && dailyCurriculum.curriculumError.value"
      class="curriculum-state"
      role="alert"
    >
      <h1>오늘 학습 정보를 불러오지 못했어.</h1>
      <button type="button" @click="retryCurriculum">다시 불러오기</button>
    </section>

    <section
      v-else-if="!showAllTrainings && dailyCurriculum.curriculumStatus.value === 'preparing'"
      class="curriculum-state"
      aria-live="polite"
    >
      <span class="state-loader" aria-hidden="true"><i/><i/><i/></span>
      <h1>오늘 학습을 준비하고 있어!</h1>
    </section>

    <section
      v-else-if="!showAllTrainings && dailyCurriculum.curriculumStatus.value === 'unavailable'"
      class="curriculum-state"
      aria-live="polite"
    >
      <h1>선생님이 추천 훈련을 준비하고 있어!</h1>
      <p>준비와 검수가 끝나면 여기에서 시작할 수 있어.</p>
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
        <h1 class="home-title">어떤 훈련을 해볼까?</h1>
        <p class="home-subtitle">하고 싶은 훈련을 골라봐!</p>
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

    <div
      v-if="isDeveloperMode && debugPanelOpen"
      class="debug-launcher-backdrop"
      role="presentation"
      @click.self="debugPanelOpen = false"
    >
      <section
        class="debug-launcher"
        role="dialog"
        aria-modal="true"
        aria-labelledby="debug-launcher-title"
      >
        <header class="debug-launcher-header">
          <div>
            <span>DEVELOPMENT ONLY</span>
            <h2 id="debug-launcher-title">전체 학습 디버그</h2>
          </div>
          <button type="button" aria-label="디버그 목록 닫기" @click="debugPanelOpen = false">×</button>
        </header>

        <div class="debug-launcher-groups">
          <section
            v-for="group in debugLessonGroups"
            :key="group.id"
            class="debug-launcher-group"
          >
            <h3>{{ group.title }}</h3>
            <div class="debug-lesson-grid">
              <button
                v-for="lesson in group.lessons"
                :key="lesson.id"
                type="button"
                @click="openDebugLesson(lesson.categoryId, lesson.id)"
              >
                <strong>{{ lesson.title }}</strong>
                <span>{{ lesson.activityType }} · {{ lesson.questions.length }}개 변형</span>
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>

  </main>
</template>

<style scoped src="@/styles/training/TrainingHomeView.css"></style>
