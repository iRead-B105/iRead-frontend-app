<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { TrainingChoice, TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import ResourceRequired from '@/components/training/ResourceRequired.vue'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

const session = useTrainingSession()
const choices = computed<TrainingChoice[]>(() => props.question.choices ?? [])
const placedChoice = ref<TrainingChoice | null>(null)
const attempts = ref(0)
const wrongChoiceId = ref<string | null>(null)
const statusMessage = ref('')
const isComplete = ref(false)
const submitting = ref(false)
let wrongTimer: ReturnType<typeof setTimeout> | null = null

const showHint = computed(() => attempts.value >= 2 && !placedChoice.value)

const finishCorrectChoice = (choice: TrainingChoice) => {
  placedChoice.value = choice
  statusMessage.value = '잘 찾았어!'
  isComplete.value = true
}

// 문장을 고르면 세션 제출 경로로 바로 채점한다(백엔드에 응답 저장). 정답이면 그림 아래에 문장이 연결된다.
const evaluateChoice = async (choiceId: string) => {
  if (placedChoice.value || submitting.value) return
  const choice = choices.value.find((item) => item.id === choiceId)
  if (!choice) return
  session.selectAnswer(choice.id)
  submitting.value = true
  try {
    const correct = await session.submitAnswer()
    if (correct) {
      finishCorrectChoice(choice)
      return
    }
    attempts.value += 1
    wrongChoiceId.value = choice.id
    statusMessage.value = '한 번 더 해봐!'
    if (wrongTimer) clearTimeout(wrongTimer)
    wrongTimer = setTimeout(() => { wrongChoiceId.value = null }, 650)
  } finally {
    submitting.value = false
  }
}

onBeforeUnmount(() => {
  if (wrongTimer) clearTimeout(wrongTimer)
})
</script>

<template>
  <section class="activity activity--sentence-choice" :aria-label="question.instruction">
    <header class="activity-heading">
      <h1>{{ placedChoice ? '그림과 문장이 연결됐어!' : '그림에 맞는 문장을 골라봐!' }}</h1>
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
          v-if="placedChoice"
          class="sentence-target filled"
        >
          <span>{{ placedChoice.text }}</span>
        </div>
      </div>

      <div class="choices" :class="{ locked: placedChoice }" aria-label="문장 고르기">
        <button
          v-for="choice in choices"
          :key="choice.id"
          type="button"
          class="sentence-card"
          :class="{
            wrong: wrongChoiceId === choice.id,
            hint: showHint && choice.id === question.answer,
            used: placedChoice?.id === choice.id,
          }"
          :disabled="Boolean(placedChoice) || submitting"
          @click="evaluateChoice(choice.id)"
        >
          <strong>{{ choice.text }}</strong>
        </button>
      </div>
    </div>

    <footer class="action-bar">
      <button v-if="isComplete" class="next-button shared-next-source" type="button" @click="$emit('next')">다음</button>
    </footer>
  </section>
</template>

<style scoped src="@/styles/training/activities/SentenceChoiceActivity.css"></style>
