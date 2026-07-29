<script setup lang="ts">
import { computed, nextTick, onMounted, ref, type CSSProperties } from 'vue'
import curriculumRabbit from '@/assets/training/curriculum-rabbit-giri.png'
import completePlatform from '@/assets/training/learning-platform-complete.png'
import currentPlatform from '@/assets/training/learning-platform-current.png'
import lockedPlatform from '@/assets/training/learning-platform-locked.png'
import arrowLeft from '@/assets/navigation/training-arrow-left.svg'
import arrowRight from '@/assets/navigation/training-arrow-right.svg'
import dateCalendar from '@/assets/training/ui/curriculum-calendar.png'
import titleSign from '@/assets/training/ui/curriculum-title-sign.png'
import progressCard from '@/assets/training/ui/curriculum-progress-card.png'
import type { TrainingLessonSummary } from '@/types/training'

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

const studyDateLabel = computed(() => {
  if (!props.studyDate) return '이번 학습'
  const date = new Date(`${props.studyDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return props.studyDate
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
  }).format(date)
})

const stepsPerPage = 4
const pageCount = computed(() => Math.max(Math.ceil(props.steps.length / stepsPerPage), 1))
const pathWidth = computed(() => Math.max(1120, pageCount.value * 1160))
const pathHeight = 420
const pathScroll = ref<HTMLElement | null>(null)
const pathOffset = ref(0)
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

const pointFor = (index: number) => {
  const pageGap = Math.floor(index / stepsPerPage) * 220
  return {
    x: 145 + index * 265 + pageGap,
    y: index % 2 === 0 ? 112 : 272,
  }
}

const pathSegments = computed(() => {
  const points = props.steps.map((_, index) => pointFor(index))
  return points.slice(1).map((point, index) => {
    const previous = points[index]!
    const middleX = (previous.x + point.x) / 2
    return {
      d: `M ${previous.x} ${previous.y} C ${middleX} ${previous.y}, ${middleX} ${point.y}, ${point.x} ${point.y}`,
      status: props.steps[index + 1]?.status === 'locked' ? 'locked' : 'active',
    }
  })
})

const nodeStyle = (step: CurriculumPathStep, index: number) => ({
  left: `${pointFor(index).x}px`,
  top: `${pointFor(index).y - 68}px`,
  '--lesson-category-color': categoryColors[step.categoryId] ?? '#ff922f',
} as CSSProperties)

const updateScrollButtons = () => {
  const element = pathScroll.value
  if (!element) return

  const pageDistance = Math.max(element.clientWidth * .98, 720)
  pathOffset.value = pathPage.value * pageDistance
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

onMounted(() => {
  void nextTick(updateScrollButtons)
})

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
      <div class="date-calendar">
        <img :src="dateCalendar" alt="" aria-hidden="true" />
        <strong>{{ studyDateLabel }}</strong>
      </div>

      <h1 id="curriculum-title" class="curriculum-title-sign">
        <img :src="titleSign" alt="" aria-hidden="true" />
        <span class="title-letter title-letter--tile">가</span>
        <span class="title-letter title-letter--orange">글</span>
        <span class="title-letter title-letter--green">자</span>
        <span class="title-letter title-letter--blue">연</span>
        <span class="title-letter title-letter--purple">습</span>
      </h1>

      <div class="progress-card" aria-label="오늘의 훈련 진행률">
        <img :src="progressCard" alt="" aria-hidden="true" />
        <span>오늘의 연습</span>
        <strong>{{ currentStepNumber }}<small>/ {{ steps.length }}</small></strong>
        <div class="progress-track">
          <i :style="{ width: `${(currentStepNumber / Math.max(steps.length, 1)) * 100}%` }"></i>
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
        ref="pathScroll"
        class="path-scroll"
        aria-label="좌우로 이어지는 학습 커리큘럼"
      >
        <div
          class="path-stage"
          :style="{
            width: `${pathWidth}px`,
            height: `${pathHeight}px`,
            transform: `translateX(-${pathOffset}px)`,
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
            v-for="(step, index) in steps"
            :key="`${step.categoryId}-${step.lesson.id}`"
            class="lesson-node"
            :class="`lesson-node--${step.status}`"
            type="button"
            :style="nodeStyle(step, index)"
            :aria-disabled="step.status === 'locked'"
            :aria-label="`${index + 1}번 ${step.lesson.title}${step.status === 'locked' ? ', 잠김' : ''}`"
            @click="selectStep(step)"
          >
            <img
              v-if="step.status === 'current'"
              class="path-rabbit"
              :src="curriculumRabbit"
              alt=""
            />

            <span class="step-number">{{ step.status === 'complete' ? '✓' : index + 1 }}</span>
            <img
              class="lesson-island"
              :src="platformImages[step.status]"
              alt=""
              aria-hidden="true"
            />
            <strong>{{ step.lesson.title }}</strong>
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
