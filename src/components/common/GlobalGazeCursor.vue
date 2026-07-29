<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useGazeCursorVisibility } from '../../composables/useGazeCursorVisibility'

type GazeEventDetail = {
  clientX?: number
  clientY?: number
  x?: number
  y?: number
  headPoseStable?: boolean
}

const visible = ref(false)
const { isCursorVisible, cursorSize, isButtonInteractionEnabled } = useGazeCursorVisibility()
const stable = ref(true)
const clientX = ref(0)
const clientY = ref(0)
const dwellProgress = ref(0)
const dwelling = ref(false)
const cursorSizePixels = computed(() => ({
  small: 40,
  medium: 56,
  large: 76,
})[cursorSize.value])
const cursorStyle = computed(() => ({
  transform: `translate3d(${clientX.value}px, ${clientY.value}px, 0) translate(-50%, -50%)`,
  width: `${cursorSizePixels.value}px`,
  height: `${cursorSizePixels.value}px`,
  '--gaze-dwell': `${dwellProgress.value * 360}deg`,
  '--gaze-ring-offset': `${Math.round(cursorSizePixels.value * 0.23)}px`,
}))

let staleTimer: number | undefined
let dwellFrame: number | undefined
let dwellStartedAt = 0
let dwellTarget: HTMLElement | null = null
let activatedTarget: HTMLElement | null = null

const DWELL_ACTIVATION_MS = 2000
const GAZE_SELECT_SELECTOR = [
  'button:not(:disabled)',
  'a[href]',
  '[role="button"]:not([aria-disabled="true"])',
].join(',')
const GAZE_INTERACTION_SCOPE_SELECTOR = [
  '.story-library',
  '.story-reader',
  '.training-home',
  '.lesson-view',
  '.complete-screen',
  '.today-complete',
  '.skill-challenge',
  '.challenge-complete',
].join(',')

function clearStaleTimer() {
  if (staleTimer !== undefined) window.clearTimeout(staleTimer)
  staleTimer = undefined
}

function clearDwell(keepActivatedTarget = false) {
  if (dwellFrame !== undefined) window.cancelAnimationFrame(dwellFrame)
  dwellFrame = undefined
  dwellStartedAt = 0
  dwellTarget = null
  dwelling.value = false
  dwellProgress.value = 0
  if (!keepActivatedTarget) activatedTarget = null
}

function updateDwellProgress() {
  if (!dwellTarget || !document.contains(dwellTarget)) {
    clearDwell()
    return
  }

  dwellProgress.value = Math.min(1, (performance.now() - dwellStartedAt) / DWELL_ACTIVATION_MS)
  if (dwellProgress.value >= 1) {
    const target = dwellTarget
    activatedTarget = target
    clearDwell(true)
    target.click()
    return
  }
  dwellFrame = window.requestAnimationFrame(updateDwellProgress)
}

function selectableTargetAt(x: number, y: number) {
  const element = document.elementFromPoint(x, y)
  const exactTarget = element?.closest<HTMLElement>(GAZE_SELECT_SELECTOR) ?? null
  if (isUsableTarget(exactTarget)) return exactTarget

  const recognitionRadius = cursorSizePixels.value / 2
  let nearestTarget: HTMLElement | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  document.querySelectorAll<HTMLElement>(GAZE_SELECT_SELECTOR).forEach((target) => {
    if (!isUsableTarget(target)) return
    const rect = target.getBoundingClientRect()
    const dx = Math.max(rect.left - x, 0, x - rect.right)
    const dy = Math.max(rect.top - y, 0, y - rect.bottom)
    const distance = Math.hypot(dx, dy)
    if (distance <= recognitionRadius && distance < nearestDistance) {
      nearestTarget = target
      nearestDistance = distance
    }
  })

  return nearestTarget
}

function isUsableTarget(target: HTMLElement | null): target is HTMLElement {
  if (!target || target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true') {
    return false
  }
  if (target.closest('.learner-header')) return false
  if (!target.closest(GAZE_INTERACTION_SCOPE_SELECTOR)) return false
  if (target.dataset.gazeDisabled === 'true') return false
  const style = window.getComputedStyle(target)
  const rect = target.getBoundingClientRect()
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
}

function updateDwellTarget(x: number, y: number, canActivate: boolean) {
  const target = canActivate ? selectableTargetAt(x, y) : null
  if (target === activatedTarget) return
  if (target !== activatedTarget) activatedTarget = null
  if (target === dwellTarget) return

  clearDwell()
  if (!target) return
  dwellTarget = target
  dwellStartedAt = performance.now()
  dwelling.value = true
  dwellFrame = window.requestAnimationFrame(updateDwellProgress)
}

function onGaze(event: Event) {
  const detail = (event as CustomEvent<GazeEventDetail>).detail
  const x = typeof detail?.clientX === 'number' ? detail.clientX : detail?.x
  const y = typeof detail?.clientY === 'number' ? detail.clientY : detail?.y
  if (typeof x !== 'number' || typeof y !== 'number') return

  clientX.value = x
  clientY.value = y
  stable.value = detail.headPoseStable !== false
  visible.value = true
  updateDwellTarget(x, y, stable.value && isButtonInteractionEnabled.value)
  clearStaleTimer()
  staleTimer = window.setTimeout(() => {
    visible.value = false
    clearDwell()
  }, 1800)
}

function onEyeTrackerState(event: Event) {
  const detail = (event as CustomEvent<{ connected?: boolean }>).detail
  if (detail?.connected === false) {
    visible.value = false
    clearDwell()
    clearStaleTimer()
  }
}

onMounted(() => {
  window.addEventListener('iread:gaze', onGaze)
  window.addEventListener('iread:eye-tracker-state', onEyeTrackerState)
})

watch(isButtonInteractionEnabled, (enabled) => {
  if (!enabled) clearDwell()
})

onBeforeUnmount(() => {
  clearStaleTimer()
  clearDwell()
  window.removeEventListener('iread:gaze', onGaze)
  window.removeEventListener('iread:eye-tracker-state', onEyeTrackerState)
})
</script>

<template>
  <div
    class="global-gaze-cursor"
    :class="{
      'global-gaze-cursor--tracking': visible,
      'global-gaze-cursor--visible': visible && isCursorVisible,
      'global-gaze-cursor--hidden': visible && !isCursorVisible,
      'global-gaze-cursor--unstable': visible && !stable,
      'global-gaze-cursor--dwelling': visible && dwelling,
    }"
    :style="cursorStyle"
    aria-hidden="true"
  >
    <span />
  </div>
</template>

<style scoped>
.global-gaze-cursor {
  position: fixed;
  z-index: 2100;
  top: 0;
  left: 0;
  border: 4px solid rgb(46 133 232 / 72%);
  border-radius: 50%;
  background: rgb(255 255 255 / 14%);
  box-shadow: 0 0 0 8px rgb(87 170 255 / 18%),0 4px 14px rgb(32 83 145 / 20%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease,border-color 120ms ease,box-shadow 120ms ease;
  will-change: transform,opacity;
}

.global-gaze-cursor--tracking {
  opacity: 1;
}

.global-gaze-cursor--hidden {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}

.global-gaze-cursor--unstable {
  border-color: rgb(245 158 11 / 82%);
  box-shadow: 0 0 0 8px rgb(245 158 11 / 18%),0 4px 14px rgb(128 82 10 / 20%);
}

.global-gaze-cursor--hidden.global-gaze-cursor--unstable {
  border-color: transparent;
  box-shadow: none;
}

.global-gaze-cursor::before {
  position: absolute;
  inset: calc(var(--gaze-ring-offset) * -1);
  border-radius: 50%;
  background: conic-gradient(#ffd33d var(--gaze-dwell),transparent 0);
  content: "";
  opacity: 0;
  -webkit-mask: radial-gradient(farthest-side,transparent calc(100% - 6px),#000 0);
  mask: radial-gradient(farthest-side,transparent calc(100% - 6px),#000 0);
}

.global-gaze-cursor--dwelling::before {
  opacity: 1;
}

.global-gaze-cursor--hidden.global-gaze-cursor--dwelling::before {
  opacity: 0.58;
}

.global-gaze-cursor span {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgb(46 133 232 / 86%);
  transform: translate(-50%,-50%);
}

.global-gaze-cursor--unstable span {
  background: rgb(217 119 6 / 90%);
}

.global-gaze-cursor--hidden span {
  opacity: 0;
}

@media (prefers-reduced-motion:reduce) {
  .global-gaze-cursor {
    transition: none;
  }
}
</style>
