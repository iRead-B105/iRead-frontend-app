<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { TrainingActivityType } from '@/types/training'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { getTutorialFamily } from '@/features/learner/tutorial/tutorialFamily'

export type TrainingTutorialStep = {
  title: string
  description: string
  target: string
  padding?: number
}

const props = defineProps<{
  visible: boolean
  trainingKey: string
  studentKey: string
  activityType: TrainingActivityType
}>()

const emit = defineEmits<{ finish: [] }>()
const currentIndex = ref(0)
const targetRect = ref<{ left: number; top: number; width: number; height: number } | null>(null)
const viewportWidth = ref(typeof window === 'undefined' ? 0 : window.innerWidth)
const viewportHeight = ref(typeof window === 'undefined' ? 0 : window.innerHeight)
const ttsLocked = ref(false)
const audioPlayer = useAudioPlayer()

const trainingIntroCopyById: Record<string, { title: string; description: string }> = {
  'first-sound': {
    title: '첫소리 글자를 골라요',
    description: '단어를 잘 듣고, 맨 앞에서 나는 소리와 같은 글자를 골라봐요.',
  },
  'word-first-sound-choice': {
    title: '첫소리 글자를 골라요',
    description: '들려주는 소리를 듣고 단어의 첫소리와 같은 글자 카드를 골라봐요.',
  },
  'last-sound': {
    title: '끝소리 글자를 골라요',
    description: '단어를 잘 듣고, 맨 끝에서 나는 소리와 같은 글자를 골라봐요.',
  },
  'same-sound': {
    title: '같은 소리의 카드를 골라요',
    description: '기준이 되는 소리를 듣고 같은 소리가 나는 글자나 카드를 골라봐요.',
  },
  'batchim-sound': {
    title: '받침 소리를 골라요',
    description: '음절의 끝에서 나는 받침 소리를 듣고 같은 소리의 글자를 골라봐요.',
  },
}

const introCopyByActivity: Partial<Record<TrainingActivityType, { title: string; description: string }>> = {
  'word-reading-grid': { title: '처음부터 차례대로 읽어요', description: '문장을 앞에서부터 차례대로 읽어봐요.' },
  'listen-and-select': { title: '소리를 듣고 골라요', description: '소리를 잘 듣고 알맞은 글자나 그림을 골라봐요.' },
  'audio-letter-choice': { title: '소리를 듣고 글자를 골라요', description: '들려주는 소리를 듣고 같은 글자를 골라봐요.' },
  'sound-choice': { title: '같은 소리를 골라요', description: '소리를 듣고 알맞은 소리나 글자를 골라봐요.' },
  'letter-build': { title: '글자를 만들어봐요', description: '소리를 듣고 알맞은 글자 카드를 순서대로 놓아봐요.' },
  'sound-manipulation': { title: '소리를 바꿔봐요', description: '글자나 소리 카드를 바꾸어 새로운 낱말을 만들어봐요.' },
  'sound-omit': { title: '소리를 빼고 만들어봐요', description: '낱말에서 안내된 소리를 빼고 남은 소리를 찾아봐요.' },
  'sound-blend': { title: '소리를 합쳐봐요', description: '조각난 소리를 순서대로 합쳐 낱말을 만들어봐요.' },
  'sentence-choice': { title: '알맞은 문장을 골라요', description: '그림이나 문제를 보고 알맞은 문장을 골라봐요.' },
  'fill-blank': { title: '빈칸을 채워봐요', description: '문장의 뜻을 생각하며 알맞은 글자를 넣어봐요.' },
  'sentence-order': { title: '문장을 순서대로 만들어요', description: '단어 카드를 올바른 순서로 놓아 문장을 만들어봐요.' },
}

const steps = computed<TrainingTutorialStep[]>(() => {
  const trainingId = props.trainingKey.split(':')[2] ?? ''
  const intro = trainingIntroCopyById[trainingId] ?? introCopyByActivity[props.activityType] ?? {
    title: '문제 푸는 방법을 알아봐요',
    description: '화면에 있는 카드와 글자를 살펴보며 문제를 해결해봐요.',
  }
  const base: TrainingTutorialStep[] = [{
    title: '먼저 안내 문장을 읽어요',
    description: '훈련 방법을 알려주는 문장을 먼저 확인해요.',
    target: '[data-training-tutorial="instruction"]',
    padding: 10,
  }]
  base[0] = {
    title: intro.title,
    description: intro.description,
    target: '[data-training-tutorial="instruction"]',
    padding: 10,
  }

  if (props.activityType === 'gaze-trace') {
    return [
      { title: '글자를 따라 읽어요', description: '화면에 보이는 글자의 획순을 눈으로 따라가며 읽어봐요.', target: '[data-training-tutorial-target="trace-glyph"]', padding: 18 },
      { title: '소리를 들어봐요', description: '이 버튼을 누르면 글자의 소리를 들을 수 있어요.', target: '[data-training-tutorial-target="listen"]', padding: 10 },
      { title: '마이크에 말해봐요', description: '글자를 다 따라간 뒤 마이크에 대고 소리 내어 말해봐요.', target: '[data-training-tutorial-target="speech"]', padding: 10 },
    ]
  }

  if (props.activityType === 'word-reading-grid') {
    return [
      ...base,
      { title: '글자를 따라 읽어요', description: '문장 속 글자를 앞에서부터 순서대로 읽어봐요.', target: '[data-training-tutorial-target="reading-content"]', padding: 14 },
      { title: '마이크에 말해봐요', description: '글자를 다 읽은 뒤 마이크에 대고 소리 내어 말해요.', target: '[data-training-tutorial-target="speech"]', padding: 10 },
    ]
  }

  if (['listen-and-select', 'audio-letter-choice', 'sound-choice'].includes(props.activityType)) {
    return [
      ...base,
      { title: '소리를 들어봐요', description: '소리 듣기 버튼을 눌러 문제의 소리를 들어요.', target: '[data-training-tutorial-target="listen"]', padding: 10 },
      { title: '알맞은 답을 골라요', description: '들은 소리와 같은 글자나 카드를 골라요.', target: '[data-training-tutorial-target="choices"]', padding: 14 },
    ]
  }

  return [
    ...base,
    { title: '문제 영역을 확인해요', description: '화면에 있는 카드와 글자를 살펴보며 문제를 해결해요.', target: '.question-scroll', padding: 14 },
  ]
})

// 같은 튜토리얼 흐름을 가진 테스트와 훈련은 완료 상태를 공유한다.
const storageKey = computed(() =>
  `iread-training-tutorial:v3:${props.studentKey}:${getTutorialFamily(props.trainingKey)}`,
)
const currentStep = computed(() => steps.value[currentIndex.value])

const spotlightBounds = computed(() => {
  const target = targetRect.value
  if (!target) return null
  const padding = currentStep.value?.padding ?? 12
  return {
    left: Math.max(0, target.left - padding),
    top: Math.max(0, target.top - padding),
    right: Math.min(viewportWidth.value, target.left + target.width + padding),
    bottom: Math.min(viewportHeight.value, target.top + target.height + padding),
  }
})

let retryTimer: ReturnType<typeof setTimeout> | null = null
let speechRunId = 0

const updateTarget = () => {
  const target = currentStep.value ? document.querySelector<HTMLElement>(currentStep.value.target) : null
  const rect = target?.getBoundingClientRect()
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    targetRect.value = null
    if (props.visible) {
      if (retryTimer) clearTimeout(retryTimer)
      retryTimer = setTimeout(updateTarget, 80)
    }
    return
  }
  targetRect.value = {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

const finish = () => {
  speechRunId += 1
  audioPlayer.stop()
  ttsLocked.value = false
  window.localStorage.setItem(storageKey.value, 'completed')
  emit('finish')
}

const stopCurrentSpeech = () => {
  speechRunId += 1
  audioPlayer.stop()
  ttsLocked.value = false
}

const next = () => {
  if (!props.visible) return
  stopCurrentSpeech()
  if (currentIndex.value >= steps.value.length - 1) {
    finish()
    return
  }
  currentIndex.value += 1
  void nextTick(() => requestAnimationFrame(() => requestAnimationFrame(updateTarget)))
}

const speakCurrentStep = () => {
  const description = currentStep.value?.description?.trim()
  if (!description || !props.visible) return

  const runId = ++speechRunId
  ttsLocked.value = true
  void audioPlayer.speak(description, 0.9).then(() => {
    if (runId !== speechRunId || !props.visible) return
    ttsLocked.value = false
    if (currentIndex.value >= steps.value.length - 1) {
      finish()
      return
    }
    currentIndex.value += 1
  })
}

watch(() => props.visible, (visible) => {
  if (!visible) {
    stopCurrentSpeech()
    return
  }
  currentIndex.value = 0
  void nextTick(() => requestAnimationFrame(() => requestAnimationFrame(updateTarget)))
  speakCurrentStep()
})
watch(currentStep, () => {
  void nextTick(() => requestAnimationFrame(() => requestAnimationFrame(updateTarget)))
  if (props.visible) speakCurrentStep()
})
const onResize = () => {
  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight
  updateTarget()
}
window.addEventListener('resize', onResize)
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (retryTimer) clearTimeout(retryTimer)
  stopCurrentSpeech()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible && targetRect && spotlightBounds" class="training-tutorial" role="dialog" aria-modal="true">
      <div class="training-tutorial__backdrop">
        <div
          class="training-tutorial__shade training-tutorial__shade--top"
          :style="{ height: `${spotlightBounds.top}px` }"
        ></div>
        <div
          class="training-tutorial__shade training-tutorial__shade--left"
          :style="{
            top: `${spotlightBounds.top}px`,
            width: `${spotlightBounds.left}px`,
            height: `${spotlightBounds.bottom - spotlightBounds.top}px`,
          }"
        ></div>
        <div
          class="training-tutorial__shade training-tutorial__shade--right"
          :style="{
            top: `${spotlightBounds.top}px`,
            left: `${spotlightBounds.right}px`,
            width: `${Math.max(0, viewportWidth - spotlightBounds.right)}px`,
            height: `${spotlightBounds.bottom - spotlightBounds.top}px`,
          }"
        ></div>
        <div
          class="training-tutorial__shade training-tutorial__shade--bottom"
          :style="{
            top: `${spotlightBounds.bottom}px`,
            height: `${Math.max(0, viewportHeight - spotlightBounds.bottom)}px`,
          }"
        ></div>
      </div>
      <div
        class="training-tutorial__spotlight"
        role="button"
        tabindex="0"
        aria-label="다음 안내 보기"
        @click.stop="next"
        @keydown.enter.prevent="next"
        @keydown.space.prevent="next"
        :style="{
          left: `${spotlightBounds.left}px`,
          top: `${spotlightBounds.top}px`,
          width: `${spotlightBounds.right - spotlightBounds.left}px`,
          height: `${spotlightBounds.bottom - spotlightBounds.top}px`,
        }"
      ></div>
    </div>
  </Teleport>
</template>

<style scoped>
.training-tutorial { position: fixed; inset: 0; z-index: 1000; pointer-events: none; }
.training-tutorial__backdrop { position: absolute; inset: 0; pointer-events: auto; }
.training-tutorial__shade { position: absolute; background: rgba(21, 29, 53, .55); pointer-events: auto; }
.training-tutorial__shade--top, .training-tutorial__shade--bottom { left: 0; width: 100%; }
.training-tutorial__shade--left { left: 0; }
.training-tutorial__shade--right { right: 0; }
.training-tutorial__spotlight { position: fixed; z-index: 1; border: 4px solid #ffd65a; border-radius: 22px; box-shadow: 0 0 0 9999px rgba(21, 29, 53, .55), 0 0 0 10px rgba(255, 214, 90, .24), 0 14px 30px rgba(21, 29, 53, .28); cursor: pointer; pointer-events: auto; transition: all .22s ease; }
</style>
