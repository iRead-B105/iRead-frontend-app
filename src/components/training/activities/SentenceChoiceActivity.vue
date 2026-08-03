<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { TrainingChoice, TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import ResourceRequired from '@/components/training/ResourceRequired.vue'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

const session = useTrainingSession()
const targetSlot = ref<HTMLElement | null>(null)
const choices = computed<TrainingChoice[]>(() => props.question.choices ?? [])
const placedChoice = ref<TrainingChoice | null>(null)
const attempts = ref(0)
const wrongChoiceId = ref<string | null>(null)
const statusMessage = ref('')
const isComplete = ref(false)
const draggingChoiceId = ref<string | null>(null)
const dragPoint = ref({ x: 0, y: 0 })
const overTarget = ref(false)
let wrongTimer: ReturnType<typeof setTimeout> | null = null

const showHint = computed(() => attempts.value >= 2 && !placedChoice.value)

const pointIsOverTarget = (clientX: number, clientY: number) => {
  const rect = targetSlot.value?.getBoundingClientRect()
  return Boolean(rect && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom)
}

const finishCorrectChoice = (choice: TrainingChoice) => {
  placedChoice.value = choice
  statusMessage.value = '잘 찾았어!'
  isComplete.value = true
  session.markRecordingComplete({ isMock: false, audioUrl: null })
}

const evaluateChoice = (choiceId: string) => {
  if (placedChoice.value) return
  const choice = choices.value.find((item) => item.id === choiceId)
  if (!choice) return
  if (choice.id === props.question.answer) {
    finishCorrectChoice(choice)
    return
  }
  attempts.value += 1
  wrongChoiceId.value = choice.id
  statusMessage.value = '한 번 더 해봐!'
  if (wrongTimer) clearTimeout(wrongTimer)
  wrongTimer = setTimeout(() => { wrongChoiceId.value = null }, 650)
}

const startPointerDrag = (event: PointerEvent, choice: TrainingChoice) => {
  if (placedChoice.value || event.button !== 0) return
  event.preventDefault()
  draggingChoiceId.value = choice.id
  dragPoint.value = { x: event.clientX, y: event.clientY }
  overTarget.value = pointIsOverTarget(event.clientX, event.clientY)
}
const onPointerMove = (event: PointerEvent) => {
  if (!draggingChoiceId.value) return
  dragPoint.value = { x: event.clientX, y: event.clientY }
  overTarget.value = pointIsOverTarget(event.clientX, event.clientY)
}
const finishPointerDrag = (event: PointerEvent) => {
  const choiceId = draggingChoiceId.value
  if (!choiceId) return
  const shouldConnect = pointIsOverTarget(event.clientX, event.clientY)
  draggingChoiceId.value = null
  overTarget.value = false
  if (shouldConnect) evaluateChoice(choiceId)
}
const cancelPointerDrag = () => {
  draggingChoiceId.value = null
  overTarget.value = false
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', finishPointerDrag)
  window.addEventListener('pointercancel', cancelPointerDrag)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', finishPointerDrag)
  window.removeEventListener('pointercancel', cancelPointerDrag)
  if (wrongTimer) clearTimeout(wrongTimer)
})
</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <header class="activity-heading">
      <h1>{{ placedChoice ? '그림과 문장이 연결됐어!' : '그림에 맞는 문장을 연결해봐!' }}</h1>
      <p v-if="statusMessage" class="status-message" :class="{ success: placedChoice }" role="status" aria-live="polite">{{ statusMessage }}</p>
    </header>

    <div class="choice-layout">
      <div class="picture-panel">
        <img
          v-if="question.targetImage"
          class="picture"
          :src="question.targetImage"
          :alt="question.targetImageLabel || '문제 그림'"
        />
        <ResourceRequired
          v-else
          class="picture"
          :label="question.targetImageLabel || '문제 그림'"
        />
        <div
          ref="targetSlot"
          class="sentence-target"
          :class="{ over: overTarget, filled: placedChoice, hint: showHint }"
        >
          <span v-if="placedChoice">{{ placedChoice.text }}</span>
        </div>
      </div>

      <div class="choices" :class="{ locked: placedChoice }" aria-label="문장 카드">
        <article
          v-for="choice in choices"
          :key="choice.id"
          class="sentence-card"
          :class="{
            wrong: wrongChoiceId === choice.id,
            hint: showHint && choice.id === question.answer,
            used: placedChoice?.id === choice.id,
          }"
          @pointerdown="startPointerDrag($event, choice)"
        >
          <strong>{{ choice.text }}</strong>
        </article>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="draggingChoiceId"
        class="drag-ghost"
        :style="{ left: `${dragPoint.x}px`, top: `${dragPoint.y}px` }"
        aria-hidden="true"
      >{{ choices.find((choice) => choice.id === draggingChoiceId)?.text }}</div>
    </Teleport>

    <footer class="action-bar">
      <button v-if="isComplete" class="next-button shared-next-source" type="button" @click="$emit('next')">다음</button>
    </footer>
  </section>
</template>

<style scoped src="@/styles/training/activities/SentenceChoiceActivity.css"></style>
