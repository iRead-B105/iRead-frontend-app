<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from 'vue'
import curriculumRabbit from '@/assets/training/curriculum-rabbit-giri.png'
import completePlatform from '@/assets/training/learning-platform-complete.png'
import currentPlatform from '@/assets/training/learning-platform-current.png'
import lockedPlatform from '@/assets/training/learning-platform-locked.png'
import arrowLeft from '@/assets/navigation/training-arrow-left.svg'
import arrowRight from '@/assets/navigation/training-arrow-right.svg'
import integratedCurriculumHeader from '@/assets/training/ui/curriculum-integrated-header.webp'
import checkIcon from '@/assets/icons/check.svg'
import type { TrainingLessonSummary } from '@/types/training'
import { formatCurriculumStudyDate } from './curriculumStudyDate'

export interface CurriculumPathStep {
  trainingId: string
  categoryId: string
  lesson: TrainingLessonSummary
  status: 'complete' | 'current' | 'locked'
}

const props = defineProps<{
  steps: CurriculumPathStep[]
  studyDate: string | null
}>()

const emit = defineEmits<{
  select: [step: CurriculumPathStep]
  locked: [step: CurriculumPathStep]
}>()

const currentStepNumber = computed(() => {
  const index = props.steps.findIndex((step) => step.status === 'current')
  return index < 0 ? props.steps.length : index + 1
})
const currentTrainingId = computed(() =>
  props.steps.find((step) => step.status === 'current')?.trainingId ?? null,
)

const studyDateLabel = computed(() => formatCurriculumStudyDate(props.studyDate))

const stepsPerPage = 4
const pageCount = computed(() => Math.max(Math.ceil(props.steps.length / stepsPerPage), 1))
const pathWidth = 1120
const pathHeight = 420
const pathPage = ref(0)
const canScrollLeft = ref(false)
const canScrollRight = ref(true)
const platformImages = {
  complete: completePlatform,
  current: currentPlatform,
  locked: lockedPlatform,
} as const
const categoryColors: Record<string, string> = {
  'phonological-awareness': '#ff922f',
  phonics: '#61bf38',
  'short-text': '#368de8',
  fluency: '#8b61df',
}

const pageStartIndex = computed(() => pathPage.value * stepsPerPage)

const visibleStepEntries = computed(() =>
  props.steps
    .slice(pageStartIndex.value, pageStartIndex.value + stepsPerPage)
    .map((step, index) => ({
      step,
      globalIndex: pageStartIndex.value + index,
    })),
)

const pointFor = (indexInPage: number) => {
  return {
    x: 145 + indexInPage * 265,
    y: indexInPage % 2 === 0 ? 112 : 272,
  }
}

const pathSegments = computed(() => {
  const points = visibleStepEntries.value.map((_, index) => pointFor(index))
  return points.slice(1).map((point, index) => {
    const previous = points[index]!
    const middleX = (previous.x + point.x) / 2
    return {
      d: `M ${previous.x} ${previous.y} C ${middleX} ${previous.y}, ${middleX} ${point.y}, ${point.x} ${point.y}`,
      status: visibleStepEntries.value[index + 1]?.step.status === 'locked' ? 'locked' : 'active',
    }
  })
})

const nodeStyle = (step: CurriculumPathStep, index: number) => ({
  left: `${pointFor(index).x}px`,
  top: `${pointFor(index).y - 68}px`,
  '--lesson-category-color': categoryColors[step.categoryId] ?? '#ff922f',
} as CSSProperties)

const updateScrollButtons = () => {
  canScrollLeft.value = pathPage.value > 0
  canScrollRight.value = pathPage.value < pageCount.value - 1
}

const movePath = (direction: -1 | 1) => {
  pathPage.value = Math.min(
    Math.max(pathPage.value + direction, 0),
    pageCount.value - 1,
  )
  updateScrollButtons()
}

watch(
  [currentTrainingId, () => props.steps.length],
  ([currentId]) => {
    const currentIndex = currentId
      ? props.steps.findIndex((step) => step.trainingId === currentId)
      : -1
    const fallbackIndex = Math.max(props.steps.length - 1, 0)
    const targetIndex = currentIndex < 0 ? fallbackIndex : currentIndex
    pathPage.value = Math.min(
      Math.floor(targetIndex / stepsPerPage),
      pageCount.value - 1,
    )
    updateScrollButtons()
  },
  { immediate: true },
)

const selectStep = (step: CurriculumPathStep) => {
  if (step.status === 'locked') {
    emit('locked', step)
    return
  }
  emit('select', step)
}
</script>

<template>
  <section class="curriculum-path" aria-labelledby="curriculum-title">
    <header class="curriculum-heading">
      <div
        class="curriculum-heading-board"
        :style="{ backgroundImage: `url(${integratedCurriculumHeader})` }"
      >
        <div class="date-calendar">
          <strong>{{ studyDateLabel }}</strong>
        </div>

        <h1 id="curriculum-title" class="curriculum-title-sign">
          <span class="title-letter title-letter--orange">글</span>
          <span class="title-letter title-letter--green">자</span>
          <span class="title-letter title-letter--blue">연</span>
          <span class="title-letter title-letter--purple">습</span>
        </h1>

        <div
          class="progress-card"
          :aria-label="`훈련 진행 ${currentStepNumber}/${steps.length}`"
        >
          <strong>{{ currentStepNumber }}<small>/{{ steps.length }}</small></strong>
          <div class="progress-track">
            <i :style="{ width: `${(currentStepNumber / Math.max(steps.length, 1)) * 100}%` }"></i>
          </div>
        </div>
      </div>
    </header>

    <div class="path-viewport">
      <button
        class="path-nav path-nav--left"
        type="button"
        aria-label="이전 훈련 보기"
        :disabled="!canScrollLeft"
        @click="movePath(-1)"
      >
        <img :src="arrowLeft" alt="" aria-hidden="true" />
      </button>

      <div
        class="path-scroll"
        aria-label="좌우로 이어지는 학습 커리큘럼"
      >
        <div
          class="path-stage"
          :style="{
            width: `${pathWidth}px`,
            height: `${pathHeight}px`,
          }"
        >
          <svg
            class="path-line"
            :viewBox="`0 0 ${pathWidth} ${pathHeight}`"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              v-for="(segment, index) in pathSegments"
              :key="index"
              :class="`path-segment--${segment.status}`"
              :d="segment.d"
            />
          </svg>

          <button
            v-for="(entry, index) in visibleStepEntries"
            :key="`${pathPage}-${entry.step.categoryId}-${entry.step.lesson.id}`"
            class="lesson-node"
            :class="`lesson-node--${entry.step.status}`"
            type="button"
            :style="nodeStyle(entry.step, index)"
            :aria-disabled="entry.step.status === 'locked'"
            :aria-label="`${entry.globalIndex + 1}번 ${entry.step.lesson.title}${entry.step.status === 'locked' ? ', 잠김' : ''}`"
            @click="selectStep(entry.step)"
          >
            <img
              v-if="entry.step.status === 'current'"
              class="path-rabbit"
              :src="curriculumRabbit"
              alt=""
            />

            <span class="step-number">
              <img v-if="entry.step.status === 'complete'" :src="checkIcon" alt="" aria-hidden="true" />
              <template v-else>{{ entry.globalIndex + 1 }}</template>
            </span>
            <img
              class="lesson-island"
              :src="platformImages[entry.step.status]"
              alt=""
              aria-hidden="true"
            />
            <strong>{{ entry.step.lesson.title }}</strong>
          </button>
        </div>
      </div>

      <button
        class="path-nav path-nav--right"
        type="button"
        aria-label="다음 훈련 보기"
        :disabled="!canScrollRight"
        @click="movePath(1)"
      >
        <img :src="arrowRight" alt="" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>

<style scoped src="@/styles/training/TrainingCurriculumPath.css"></style>
