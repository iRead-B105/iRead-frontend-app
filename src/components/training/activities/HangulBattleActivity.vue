<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref } from 'vue'
import type { HangulBattleRound, HangulBattleTile, TrainingQuestion } from '@/types/training'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { getCachedStudent } from '@/services/learnerDataRepository'
import progressStar from '@/assets/training/ui/progress-star.png'

import rabbitSmile from '@/assets/battle/rabbit-smile.png'
import rabbitJump from '@/assets/battle/rabbit-jump.png'
import rabbitCry from '@/assets/battle/rabbit-cry.png'
import turtleSmile from '@/assets/battle/turtle-smile.png'
import turtleJump from '@/assets/battle/turtle-jump.png'
import turtleCry from '@/assets/battle/turtle-cry.png'
import antSmile from '@/assets/battle/ant-smile.png'
import antJump from '@/assets/battle/ant-jump.png'
import antCry from '@/assets/battle/ant-cry.png'

const props = defineProps<{ question: TrainingQuestion }>()
const emit = defineEmits<{ next: [] }>()

const session = useTrainingSession()
const studentName = getCachedStudent().name

type GamePhase = 'ready' | 'racing' | 'round-result' | 'match-result'
type RoundWinner = 'player' | 'opponent'

const phase = ref<GamePhase>('ready')
const roundIndex = ref(0)
const playerWins = ref(0)
const opponentWins = ref(0)
const roundWinner = ref<RoundWinner | null>(null)
const opponentFilledCount = ref(0)
const placements = reactive<Record<number, string>>({})
const draggedTileId = ref<string | null>(null)
const activeSlot = ref<number | null>(null)
const suppressSlotClick = ref<number | null>(null)
const boardWrong = ref(false)
let opponentTimer: ReturnType<typeof setInterval> | null = null
let wrongTimer: ReturnType<typeof setTimeout> | null = null

const rounds = computed<HangulBattleRound[]>(() => props.question.battleRounds ?? [])
const currentRound = computed(() => rounds.value[roundIndex.value] ?? null)
const opponentId = computed(() => props.question.battleOpponent ?? 'rabbit')
const opponentName = computed(() => ({ rabbit: '토끼', turtle: '거북이', ant: '개미' })[opponentId.value])
const isRacing = computed(() => phase.value === 'racing')
const usedTileIds = computed(() => new Set(Object.values(placements)))
const allFilled = computed(() => {
  const target = currentRound.value
  if (!target) return false
  return target.answer.every((_, index) => Boolean(placements[index]))
})
const isFinalRound = computed(() => roundIndex.value === rounds.value.length - 1)
const playerWonMatch = computed(() => playerWins.value > opponentWins.value)

const opponentImages = {
  rabbit: { smile: rabbitSmile, jump: rabbitJump, cry: rabbitCry },
  turtle: { smile: turtleSmile, jump: turtleJump, cry: turtleCry },
  ant: { smile: antSmile, jump: antJump, cry: antCry },
}

const opponentImage = computed(() => {
  const images = opponentImages[opponentId.value]
  if (phase.value === 'match-result') return playerWonMatch.value ? images.cry : images.jump
  if (phase.value === 'round-result') return roundWinner.value === 'player' ? images.cry : images.jump
  return images.smile
})

const tileById = (id: string | undefined): HangulBattleTile | undefined =>
  currentRound.value?.tiles.find((tile) => tile.id === id)
const textFor = (id: string | undefined) => tileById(id)?.text ?? ''

const clearTimers = () => {
  if (opponentTimer) clearInterval(opponentTimer)
  if (wrongTimer) clearTimeout(wrongTimer)
  opponentTimer = null
  wrongTimer = null
}

const clearBoard = () => {
  Object.keys(placements).forEach((key) => delete placements[Number(key)])
  draggedTileId.value = null
  activeSlot.value = null
  suppressSlotClick.value = null
  opponentFilledCount.value = 0
  boardWrong.value = false
}

const startOpponent = () => {
  const target = currentRound.value
  if (!target) return
  const startedAt = Date.now()
  opponentTimer = setInterval(() => {
    const ratio = Math.min((Date.now() - startedAt) / target.opponentDurationMs, 1)
    if (ratio >= 1) {
      opponentFilledCount.value = target.answer.length
      finishRound('opponent')
    } else {
      opponentFilledCount.value = Math.min(
        Math.max(target.answer.length - 1, 0),
        Math.floor(ratio * target.answer.length),
      )
    }
  }, 120)
}

const startRace = () => {
  if (!currentRound.value || phase.value !== 'ready') return
  clearBoard()
  phase.value = 'racing'
  startOpponent()
}

const boardIsCorrect = () => {
  const target = currentRound.value
  if (!target) return false
  return target.answer.every((answerText, index) => textFor(placements[index]) === answerText)
}

const finishRound = (winner: RoundWinner) => {
  if (phase.value !== 'racing') return
  clearTimers()
  roundWinner.value = winner
  if (winner === 'player') playerWins.value += 1
  else opponentWins.value += 1
  phase.value = 'round-result'
}

const checkBoard = () => {
  if (!allFilled.value || !isRacing.value) return
  if (boardIsCorrect()) {
    finishRound('player')
  } else {
    boardWrong.value = true
    if (wrongTimer) clearTimeout(wrongTimer)
    wrongTimer = setTimeout(() => { boardWrong.value = false }, 650)
  }
}

const placeTile = (tileId: string, slotIndex: number) => {
  if (!isRacing.value) return
  Object.keys(placements).forEach((key) => {
    if (placements[Number(key)] === tileId) delete placements[Number(key)]
  })
  placements[slotIndex] = tileId
  void nextTick(checkBoard)
}

const startDrag = (event: DragEvent, tileId: string) => {
  if (!isRacing.value) return
  draggedTileId.value = tileId
  event.dataTransfer?.setData('text/plain', tileId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

const startPointerDrag = (tileId: string) => {
  if (isRacing.value) draggedTileId.value = tileId
}

const dropOn = (event: DragEvent, slotIndex: number) => {
  const tileId = event.dataTransfer?.getData('text/plain') || draggedTileId.value
  draggedTileId.value = null
  activeSlot.value = null
  if (tileId) placeTile(tileId, slotIndex)
}

const pointerDropOn = (slotIndex: number) => {
  const tileId = draggedTileId.value
  if (!tileId) return
  suppressSlotClick.value = slotIndex
  placeTile(tileId, slotIndex)
  draggedTileId.value = null
  activeSlot.value = null
}

const clearSlot = (slotIndex: number) => {
  if (suppressSlotClick.value === slotIndex) {
    suppressSlotClick.value = null
    return
  }
  if (!isRacing.value || !placements[slotIndex]) return
  delete placements[slotIndex]
  boardWrong.value = false
}

const advanceRound = () => {
  if (phase.value !== 'round-result') return
  if (isFinalRound.value) {
    phase.value = 'match-result'
    session.markRecordingComplete({ isMock: true, audioUrl: null })
    return
  }
  roundIndex.value += 1
  roundWinner.value = null
  clearBoard()
  phase.value = 'ready'
}

const finishMatch = () => emit('next')

const releasePointer = () => {
  draggedTileId.value = null
  activeSlot.value = null
}

window.addEventListener('pointerup', releasePointer)
onUnmounted(() => {
  clearTimers()
  window.removeEventListener('pointerup', releasePointer)
})
</script>

<template>
  <section class="battle" :aria-label="question.instruction">
    <header class="scoreboard">
      <strong>{{ studentName }}</strong>
      <span>{{ playerWins }}</span>
      <b>:</b>
      <span>{{ opponentWins }}</span>
      <strong>{{ opponentName }}</strong>
      <div class="round-dots" :aria-label="`전체 ${rounds.length}판 중 ${roundIndex + 1}판`">
        <i v-for="index in rounds.length" :key="index" :class="{ active: index - 1 === roundIndex }"></i>
      </div>
    </header>

    <div class="battle-body">
      <aside class="opponent-panel">
        <span class="opponent-badge">{{ opponentName }}</span>
        <img :src="opponentImage" :alt="`${opponentName} 캐릭터`" />
        <strong v-if="phase === 'racing'">만드는 중!</strong>
      </aside>

      <main v-if="currentRound" class="game-board">
        <div class="word-row">
          <strong class="target-word">{{ currentRound.word }}</strong>
        </div>

        <div class="race-board opponent-board" aria-label="상대 조합 진행">
          <span
            v-for="(_, index) in currentRound.answer"
            :key="`opponent-${index}`"
            class="opponent-slot"
            :class="{ filled: index < opponentFilledCount }"
          ></span>
        </div>

        <div class="race-board player-board" :class="{ wrong: boardWrong }" :aria-label="`${studentName} 글자 조합판`">
          <button
            v-for="(_, index) in currentRound.answer"
            :key="`player-${index}`"
            class="player-slot"
            :class="{ filled: placements[index], active: activeSlot === index }"
            type="button"
            :aria-label="`${index + 1}번째 글자 자리${placements[index] ? `, ${textFor(placements[index])} 놓임` : ''}`"
            @dragenter.prevent="activeSlot = index"
            @dragover.prevent
            @drop.prevent="dropOn($event, index)"
            @pointerenter="draggedTileId && (activeSlot = index)"
            @pointerleave="activeSlot === index && (activeSlot = null)"
            @pointerup="pointerDropOn(index)"
            @click="clearSlot(index)"
          >
            {{ placements[index] ? textFor(placements[index]) : index + 1 }}
          </button>
        </div>

        <div class="tile-pool" aria-label="한글 타일">
          <div
            v-for="tile in currentRound.tiles"
            :key="tile.id"
            class="hangul-tile"
            :class="{ used: usedTileIds.has(tile.id) }"
            :draggable="isRacing"
            role="button"
            :tabindex="isRacing ? 0 : -1"
            :aria-label="`${tile.text} 타일`"
            @dragstart="startDrag($event, tile.id)"
            @pointerdown="startPointerDrag(tile.id)"
          >
            {{ tile.text }}
          </div>
        </div>

        <div v-if="phase === 'ready'" class="board-overlay ready-overlay">
          <span>VS</span>
          <strong>{{ currentRound.word }}</strong>
          <button type="button" @click="startRace">대결 시작!</button>
        </div>

        <div v-else-if="phase === 'round-result'" class="board-overlay result-overlay" role="status">
          <div class="stars" aria-hidden="true">
            <img
              v-for="starIndex in 3"
              :key="starIndex"
              :class="{ 'star--inactive': roundWinner !== 'player' }"
              :src="progressStar"
              alt=""
            />
          </div>
          <strong>{{ roundWinner === 'player' ? `${studentName} 승리!` : `${opponentName} 승리!` }}</strong>
          <p>{{ currentRound.word }}</p>
          <button class="shared-next-source" type="button" @click="advanceRound">{{ isFinalRound ? '최종 결과' : '다음 낱말' }}</button>
        </div>

        <div v-else-if="phase === 'match-result'" class="board-overlay match-overlay" role="status">
          <div class="stars" aria-hidden="true">
            <img
              v-for="starIndex in 3"
              :key="starIndex"
              :class="{ 'star--inactive': !playerWonMatch && starIndex !== 2 }"
              :src="progressStar"
              alt=""
            />
          </div>
          <strong>{{ playerWonMatch ? `${studentName} 최종 승리!` : `${opponentName} 최종 승리!` }}</strong>
          <p>{{ playerWins }} : {{ opponentWins }}</p>
          <button type="button" @click="finishMatch">대결 끝내기</button>
        </div>
      </main>
    </div>
  </section>
</template>

<style scoped src="@/styles/training/activities/HangulBattleActivity.css"></style>
