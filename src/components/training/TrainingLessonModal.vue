<script setup lang="ts">
// 훈련 서브메뉴 모달
// 기존 모달 패턴(StoryLandModal 참고)을 따릅니다.
// 한 카테고리의 레슨 목록(5개)을 보여주고, 준비 중 레슨 선택 시
// "이 훈련은 준비하고 있어요." 메시지를 표시합니다.

import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { TrainingCategory } from '@/types/training'
import TrainingLessonCard from './TrainingLessonCard.vue'

const props = defineProps<{
  open: boolean
  category: TrainingCategory | null
}>()

const emit = defineEmits<{
  select: [lessonId: string]
  close: []
}>()

const panel = ref<HTMLElement | null>(null)
const notReadyMessage = ref<string | null>(null)
let notReadyTimer: ReturnType<typeof setTimeout> | null = null

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.open) emit('close')
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeydown)
      await nextTick()
      panel.value?.focus()
    } else {
      window.removeEventListener('keydown', handleKeydown)
    }
  },
)

watch(
  () => props.category?.id,
  () => {
    notReadyMessage.value = null
  },
)

const handleNotReady = (lessonId: string) => {
  const lesson = props.category?.lessons.find((l) => l.id === lessonId)
  notReadyMessage.value = lesson
    ? `${lesson.title}은(는) 준비하고 있어요.`
    : '이 훈련은 준비하고 있어요.'
  if (notReadyTimer) clearTimeout(notReadyTimer)
  notReadyTimer = setTimeout(() => {
    notReadyMessage.value = null
  }, 2200)
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (notReadyTimer) clearTimeout(notReadyTimer)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open && category"
        class="lesson-modal-overlay"
        @click.self="emit('close')"
      >
        <section
          ref="panel"
          class="lesson-modal-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="`${category.title} 레슨 선택`"
          tabindex="-1"
        >
          <header class="modal-heading">
            <div class="heading-icon">
              <img :src="category.image" :alt="category.title" />
            </div>
            <div class="heading-text">
              <h2 class="heading-title">{{ category.title }}</h2>
              <p class="heading-desc">{{ category.description }}</p>
            </div>
            <button class="modal-close" type="button" aria-label="닫기" @click="emit('close')">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
              </svg>
            </button>
          </header>

          <div class="modal-body">
            <ul class="lesson-list">
              <li v-for="lesson in category.lessons" :key="lesson.id">
                <TrainingLessonCard
                  :lesson="lesson"
                  @select="emit('select', $event)"
                  @not-ready="handleNotReady"
                />
              </li>
            </ul>

            <Transition name="toast">
              <p v-if="notReadyMessage" class="not-ready-toast" role="status">
                {{ notReadyMessage }}
              </p>
            </Transition>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped src="@/styles/training/TrainingLessonModal.css"></style>
