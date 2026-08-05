<script setup lang="ts">
import { ref } from 'vue'
import { useDeveloperMode } from '@/composables/useDeveloperMode'

// 개발자 모드(로고 5클릭)에서만 노출되는 실시간 로그 오버레이.
// 시선 단어 히트와 음성 정답·정확도 결과를 실시간으로 표시하며,
// 헤더를 잡고 드래그해 화면 어디로든 옮길 수 있다.
const {
  enabled: isDeveloperMode,
  devGazeLog,
  devVoiceLog,
  clearDevLogs,
} = useDeveloperMode()

const overlay = ref<HTMLElement | null>(null)
// 드래그 전에는 null(기본 CSS 위치), 드래그를 시작하면 left/top 좌표로 전환한다
const dragPosition = ref<{ x: number; y: number } | null>(null)
let dragOffset = { x: 0, y: 0 }

const moveWithinViewport = (event: PointerEvent) => {
  const el = overlay.value
  if (!el) return
  const maxX = Math.max(window.innerWidth - el.offsetWidth, 0)
  const maxY = Math.max(window.innerHeight - el.offsetHeight, 0)
  dragPosition.value = {
    x: Math.min(Math.max(event.clientX - dragOffset.x, 0), maxX),
    y: Math.min(Math.max(event.clientY - dragOffset.y, 0), maxY),
  }
}

const startDrag = (event: PointerEvent) => {
  if (event.button !== 0) return
  // 지우기 버튼 클릭은 드래그로 취급하지 않는다
  if ((event.target as HTMLElement | null)?.closest('button')) return
  const el = overlay.value
  if (!el) return

  const rect = el.getBoundingClientRect()
  dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  dragPosition.value = { x: rect.left, y: rect.top }

  el.setPointerCapture(event.pointerId)
  const stop = () => {
    el.removeEventListener('pointermove', moveWithinViewport)
    el.removeEventListener('pointerup', stop)
    el.removeEventListener('pointercancel', stop)
  }
  el.addEventListener('pointermove', moveWithinViewport)
  el.addEventListener('pointerup', stop)
  el.addEventListener('pointercancel', stop)
  event.preventDefault()
}
</script>

<template>
  <aside
    v-if="isDeveloperMode"
    ref="overlay"
    class="dev-log-overlay"
    :class="{ 'dev-log-overlay--moved': dragPosition }"
    :style="dragPosition ? { left: `${dragPosition.x}px`, top: `${dragPosition.y}px` } : undefined"
    aria-label="개발자 실시간 로그"
    @pointerdown="startDrag"
  >
    <header class="dev-log-header">
      <strong>DEV 실시간 로그</strong>
      <button type="button" @click="clearDevLogs">지우기</button>
    </header>
    <div class="dev-log-columns">
      <section class="dev-log-section">
        <h4>시선 데이터 <small>({{ devGazeLog.length }})</small></h4>
        <ul>
          <li v-for="(entry, index) in devGazeLog" :key="`gaze-${index}`">
            <span class="ts">{{ entry.capturedAt }}</span>
            <span class="word">{{ entry.text }}</span>
            <span class="meta">({{ Math.round(entry.clientX) }},{{ Math.round(entry.clientY) }}) Q{{ entry.questionNumber }}·t{{ entry.tokenIndex }}</span>
          </li>
          <li v-if="!devGazeLog.length" class="empty">시선 단어 히트 대기 중…</li>
        </ul>
      </section>
      <section class="dev-log-section">
        <h4>음성 정답·정확도 <small>({{ devVoiceLog.length }})</small></h4>
        <ul>
          <li
            v-for="(entry, index) in devVoiceLog"
            :key="`voice-${index}`"
            :class="entry.issue ? 'fail' : entry.passed ? 'pass' : 'fail'"
          >
            <span class="ts">{{ entry.capturedAt }}</span>
            <template v-if="entry.issue">
              <span class="word">{{ entry.expectedText }}</span>
              <span class="res">⚠ {{ entry.issue }}</span>
            </template>
            <template v-else>
              <span class="score">{{ entry.score }}/{{ entry.threshold }}점</span>
              <span class="word">{{ entry.expectedText }}</span>
              <span class="res">{{ entry.passed ? '정답' : '재시도' }}</span>
            </template>
          </li>
          <li v-if="!devVoiceLog.length" class="empty">음성 평가 대기 중…</li>
        </ul>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.dev-log-overlay {
  position: fixed;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 9999;
  width: 380px;
  max-width: calc(100vw - 24px);
  max-height: 70vh;
  padding: 8px 10px 10px;
  border-radius: 12px;
  background: rgba(18, 22, 30, 0.94);
  color: #e8edf4;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  line-height: 1.5;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
  /* 어디를 잡아도 드래그로 옮길 수 있다 */
  pointer-events: auto;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.dev-log-overlay:active {
  cursor: grabbing;
}

/* 드래그로 옮긴 뒤에는 인라인 left/top이 위치를 결정한다 */
.dev-log-overlay--moved {
  transform: none;
}

.dev-log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.dev-log-header strong {
  font-size: 12px;
  letter-spacing: 0.02em;
}

.dev-log-header button {
  padding: 2px 8px;
  border: 0;
  border-radius: 6px;
  background: #333b4d;
  color: #cdd6e4;
  font-family: inherit;
  font-size: 10px;
  cursor: pointer;
}

.dev-log-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.dev-log-section {
  min-width: 0;
}

.dev-log-section h4 {
  margin: 0 0 4px;
  color: #8aa0c0;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.dev-log-section h4 small {
  color: #5f6e87;
  font-weight: 400;
}

.dev-log-section ul {
  max-height: 30vh;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  pointer-events: auto;
}

.dev-log-section li {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  padding: 2px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.dev-log-section .ts {
  color: #6f7d96;
}

.dev-log-section .word {
  color: #9ad0ff;
  font-weight: 700;
}

.dev-log-section .meta {
  color: #8b97ab;
  font-size: 10px;
}

.dev-log-section .score {
  color: #ffd166;
  font-weight: 700;
}

.dev-log-section .res {
  margin-left: auto;
  font-weight: 700;
}

.dev-log-section li.pass .res {
  color: #7bd88f;
}

.dev-log-section li.fail .res {
  color: #f08090;
}

.dev-log-section .empty {
  color: #6f7d96;
  font-style: italic;
}
</style>
