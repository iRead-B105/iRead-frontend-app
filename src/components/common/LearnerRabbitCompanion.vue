<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import rabbitIdle from '@/assets/companion/rabbit-idle.webp'
import rabbitGreeting from '@/assets/companion/rabbit-greeting.webp'
import rabbitMicrophone from '@/assets/companion/rabbit-microphone.webp'
import rabbitCorrect from '@/assets/companion/rabbit-correct.webp'
import rabbitStory from '@/assets/companion/rabbit-story.webp'
import rabbitRetry from '@/assets/companion/rabbit-retry.webp'
import rabbitCelebrate from '@/assets/companion/rabbit-celebrate.webp'
import speechBubble from '@/assets/companion/speech-bubble.webp'

type RabbitState = 'idle' | 'greeting' | 'microphone' | 'correct' | 'story' | 'retry' | 'celebrate'

const route = useRoute()
const state = ref<RabbitState>('idle')
const hovered = ref(false)
const character = ref<HTMLButtonElement | null>(null)
let observer: MutationObserver | null = null
let refreshFrame = 0
let gazeLeaveTimer = 0

const rabbitAssets: Record<RabbitState, string> = {
  idle: rabbitIdle,
  greeting: rabbitGreeting,
  microphone: rabbitMicrophone,
  correct: rabbitCorrect,
  story: rabbitStory,
  retry: rabbitRetry,
  celebrate: rabbitCelebrate,
}

const messages: Record<RabbitState, string> = {
  idle: '같이 해보자!',
  greeting: '안녕! 만나서 반가워!',
  microphone: '네 목소리를 듣고 있어!',
  correct: '정말 잘했어!',
  story: '이야기를 같이 읽어보자!',
  retry: '괜찮아, 다시 해보자!',
  celebrate: '와! 정말 대단해!',
}

const currentAsset = computed(() => rabbitAssets[state.value])
const currentMessage = computed(() => messages[state.value])
const isCompletionRoute = () => String(route.name ?? '').includes('complete')
const isStoryRoute = () => String(route.name ?? '').startsWith('story-')

const deriveState = (): RabbitState => {
  if (isCompletionRoute()) return 'celebrate'
  if (document.querySelector('.speech-panel--listening, .speech-panel--evaluating, [data-companion-state="microphone"]')) return 'microphone'
  if (document.querySelector('.speech-panel--retry, .status-message.retry, .letter-card--wrong, .curtain-choice--wrong, .build-feedback, [data-companion-state="retry"]')) return 'retry'
  if (document.querySelector('.speech-panel--success, .letter-card--correct, .curtain-choice--correct, [data-companion-state="correct"]')) return 'correct'
  if (isStoryRoute()) return 'story'
  return 'idle'
}

// DOM 클래스가 갈리는 찰나(듣는 중→평가 중→성공)에 idle로 튕겼다 돌아오며
// 이미지가 파바밧 깜빡이지 않도록, 새 상태가 잠시 유지될 때만 반영한다
const STATE_STABLE_MS = 160
let pendingState: RabbitState | null = null
let stateTimer = 0

const applyDerivedState = () => {
  if (hovered.value) return
  const next = deriveState()
  if (next === state.value) {
    pendingState = null
    window.clearTimeout(stateTimer)
    return
  }
  if (next === pendingState) return
  pendingState = next
  window.clearTimeout(stateTimer)
  stateTimer = window.setTimeout(() => {
    if (pendingState && !hovered.value) state.value = pendingState
    pendingState = null
  }, STATE_STABLE_MS)
}

const refreshState = () => {
  cancelAnimationFrame(refreshFrame)
  refreshFrame = requestAnimationFrame(applyDerivedState)
}

const greet = () => {
  hovered.value = true
  pendingState = null
  window.clearTimeout(stateTimer)
  state.value = 'greeting'
}

const restore = () => {
  hovered.value = false
  state.value = deriveState()
}

const onGaze = (event: Event) => {
  const detail = (event as CustomEvent<{ clientX?: number; clientY?: number; x?: number; y?: number }>).detail
  const x = detail?.clientX ?? detail?.x
  const y = detail?.clientY ?? detail?.y
  const rect = character.value?.getBoundingClientRect()
  if (typeof x !== 'number' || typeof y !== 'number' || !rect) return
  const isLooking = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  window.clearTimeout(gazeLeaveTimer)
  if (isLooking) {
    greet()
  } else if (hovered.value) {
    gazeLeaveTimer = window.setTimeout(restore, 300)
  }
}

watch(() => route.fullPath, () => void nextTick(refreshState))

onMounted(() => {
  // 상태 전환 시 로딩 깜빡임 없이 즉시 바뀌도록 모든 상태 이미지를 미리 받아 둔다
  Object.values(rabbitAssets).forEach((src) => {
    new Image().src = src
  })
  observer = new MutationObserver(refreshState)
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'data-companion-state'],
  })
  window.addEventListener('iread:gaze', onGaze)
  refreshState()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(refreshFrame)
  window.clearTimeout(gazeLeaveTimer)
  window.clearTimeout(stateTimer)
  window.removeEventListener('iread:gaze', onGaze)
})
</script>

<template>
  <aside class="rabbit-companion" :class="`rabbit-companion--${state}`" aria-live="polite">
    <div class="rabbit-companion__bubble">
      <img :src="speechBubble" alt="" aria-hidden="true" />
      <p>{{ currentMessage }}</p>
    </div>
    <button
      ref="character"
      class="rabbit-companion__character"
      type="button"
      aria-label="토끼에게 인사하기"
      @pointerenter="greet"
      @pointerleave="restore"
      @focus="greet"
      @blur="restore"
    >
      <img :src="currentAsset" alt="" aria-hidden="true" />
    </button>
  </aside>
</template>

<style scoped src="@/styles/common/LearnerRabbitCompanion.css"></style>
