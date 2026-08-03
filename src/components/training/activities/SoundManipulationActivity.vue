<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { SoundManipulationUnit, TrainingChoice, TrainingQuestion } from '@/types/training'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useTrainingSession } from '@/composables/useTrainingSession'
import SoundButton from '../SoundButton.vue'
import soundControlPanel from '@/assets/training/sound-puzzle/sound-control-panel.svg'
import completeButtonDisabled from '@/assets/training/sound-puzzle/complete-button-disabled.png'
import completeButtonActive from '@/assets/training/sound-puzzle/complete-button-active.png'
import completeButtonSuccess from '@/assets/training/sound-puzzle/complete-button-success.png'

const props = defineProps<{ question: TrainingQuestion }>()
defineEmits<{ next: [] }>()

const session = useTrainingSession()
const audio = useAudioPlayer()
const selectedUnitIds = ref<string[]>([])
const selectedReplacementId = ref<string | null>(null)

const units = computed<SoundManipulationUnit[]>(() => props.question.manipulationUnits ?? [])
const replacements = computed<TrainingChoice[]>(() => props.question.replacementChoices ?? [])
const isReplace = computed(() => props.question.manipulationMode === 'replace')
const isCorrect = computed(() => session.progressState.isCurrentCorrect === true)
const targetIds = computed(() => props.question.manipulationTargetUnitIds ?? [])
const canSubmit = computed(() =>
  isReplace.value
    ? selectedUnitIds.value.length === 1 && Boolean(selectedReplacementId.value)
    : selectedUnitIds.value.length > 0,
)
const completeButtonImage = computed(() => {
  if (isCorrect.value) return completeButtonSuccess
  return canSubmit.value ? completeButtonActive : completeButtonDisabled
})

const playQuestion = () => {
  if (props.question.audioText) void audio.replay(props.question.audioText, 0.82)
}

const resetJudgement = () => session.selectAnswer('조작 중')

const toggleUnit = (unitId: string) => {
  if (isCorrect.value) return
  if (isReplace.value) {
    selectedUnitIds.value = selectedUnitIds.value[0] === unitId ? [] : [unitId]
  } else if (selectedUnitIds.value.includes(unitId)) {
    selectedUnitIds.value = selectedUnitIds.value.filter((id) => id !== unitId)
  } else {
    selectedUnitIds.value = [...selectedUnitIds.value, unitId]
  }
  resetJudgement()
}

const selectReplacement = (choiceId: string) => {
  if (isCorrect.value) return
  selectedReplacementId.value = choiceId
  resetJudgement()
}

const sameSet = (left: string[], right: string[]) =>
  left.length === right.length && left.every((id) => right.includes(id))

const submit = async () => {
  if (!canSubmit.value || isCorrect.value) return

  let correct = false
  let submitted = ''
  if (isReplace.value) {
    submitted = `${selectedUnitIds.value[0]}:${selectedReplacementId.value}`
    correct = sameSet(selectedUnitIds.value, targetIds.value)
      && selectedReplacementId.value === props.question.replacementAnswerId
  } else {
    const answerSets = props.question.manipulationAnswerSets?.length
      ? props.question.manipulationAnswerSets
      : [targetIds.value]
    correct = answerSets.some((answerSet) => sameSet(selectedUnitIds.value, answerSet))
    submitted = [...selectedUnitIds.value].sort().join('|')
  }

  session.selectAnswer(correct ? props.question.answer : submitted)
  const completed = await session.submitAnswer()
  if (completed) {
    void audio.speak(props.question.targetResult ?? '', 0.8)
  } else if (session.progressState.attemptCount >= 2 && session.progressState.hintLevel < 2) {
    session.showHint()
    selectedUnitIds.value = []
    selectedReplacementId.value = null
  }
}

const isTargetUnit = (unitId: string) => targetIds.value.includes(unitId)
const showPulse = (unitId: string) => session.progressState.hintLevel >= 1 && isTargetUnit(unitId)
const showDirectHint = (unitId: string) => session.progressState.hintLevel >= 2 && isTargetUnit(unitId)

watch(
  () => props.question.id,
  () => {
    selectedUnitIds.value = []
    selectedReplacementId.value = null
    void nextTick(playQuestion)
  },
  { immediate: true },
)
</script>

<template>
  <section class="activity" :aria-label="question.instruction">
    <h1>{{ question.instruction }}</h1>

    <div class="play-area">
      <div class="manipulation-panel">
        <div class="word-flow">
          <div class="source-group" :aria-label="`${question.targetText} 소리 조각`">
            <button
              v-for="soundUnit in units"
              :key="soundUnit.id"
              class="sound-unit"
              :class="{
                'sound-unit--selected': selectedUnitIds.includes(soundUnit.id),
                'sound-unit--pulse': showPulse(soundUnit.id),
                'sound-unit--direct': showDirectHint(soundUnit.id),
              }"
              type="button"
              :aria-pressed="selectedUnitIds.includes(soundUnit.id)"
              :aria-label="`${soundUnit.text} 소리${selectedUnitIds.includes(soundUnit.id) ? ' 빼기 선택됨' : ''}`"
              @click="toggleUnit(soundUnit.id)"
            >
              {{ soundUnit.text }}
              <span v-if="showDirectHint(soundUnit.id)" class="scissors" aria-hidden="true">✂</span>
            </button>
          </div>
        </div>

        <div v-if="isReplace" class="replacement-area choices" aria-label="바꿀 소리 카드">
          <button
            v-for="replacement in replacements"
            :key="replacement.id"
            class="replacement-card"
            :class="{
              'replacement-card--selected': selectedReplacementId === replacement.id,
              'replacement-card--hint': session.progressState.hintLevel >= 2 && replacement.id === question.replacementAnswerId,
            }"
            type="button"
            :aria-pressed="selectedReplacementId === replacement.id"
            @click="selectReplacement(replacement.id)"
          >
            {{ replacement.text }}
          </button>
        </div>
        <p v-if="session.progressState.isCurrentCorrect === false" class="build-feedback" role="status">
          소리를 다시 골라봐!
        </p>
      </div>

      <div class="function-panel">
        <div class="sound-control-card">
          <img :src="soundControlPanel" alt="" aria-hidden="true" />
          <SoundButton
            :text="question.audioText ?? ''"
            size="large"
            variant="primary"
            label="만들 소리 듣기"
          />
        </div>

        <button
          class="complete-button"
          :class="{ 'complete-button--success': isCorrect }"
          type="button"
          :disabled="!canSubmit || isCorrect"
          @click="submit"
        >
          <img :src="completeButtonImage" alt="" aria-hidden="true" />
          <span>완성!</span>
        </button>
      </div>
    </div>

    <button
      v-if="isCorrect"
      class="shared-next-source"
      type="button"
      tabindex="-1"
      aria-hidden="true"
      @click="$emit('next')"
    ></button>
  </section>
</template>

<style scoped src="@/styles/training/activities/SoundManipulationActivity.css"></style>
