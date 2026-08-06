<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import storyScene from '../../assets/story/story-reader-turtle-scene-mock.webp'
import { fetchGazeCalibrationGuide } from '@/services/learnerDataRepository'

type BridgeAnchorTarget = string | Element | { x: number; y: number } | { clientX: number; clientY: number }
type BridgeControls = {
  sampleAnchor: (name: string, target: BridgeAnchorTarget, durationMs?: number) => Promise<unknown>
  fitAnchors: (xStartName: string, xEndName: string, yStartName?: string, yEndName?: string) => unknown
  resetTransform: () => unknown
  clearAnchors: () => unknown
  clearRecentSamples?: () => unknown
  resetHeadPoseBaseline?: () => unknown
}

type GazeEventDetail = {
  clientX?: number
  clientY?: number
  rawClientX?: number
  rawClientY?: number
  x?: number
  y?: number
}

const emit = defineEmits<{ close: [] }>()

const targets = [
  { id: 'left', label: '왼쪽', style: { left: '18%', top: '50%' } },
  { id: 'right', label: '오른쪽', style: { left: '82%', top: '50%' } },
  { id: 'top', label: '위쪽', style: { left: '50%', top: '24%' } },
  { id: 'bottom', label: '아래쪽', style: { left: '50%', top: '76%' } },
] as const

const DWELL_CAPTURE_MS = 760
const SAMPLE_MS = 1250
const HIT_PADDING = 96

const stepIndex = ref(0)
const status = ref<'ready' | 'dwelling' | 'sampling' | 'complete' | 'error'>('ready')
const errorMessage = ref('')
const guideMessage = ref('빛나는 점을 바라보면 자동으로 저장돼요.')
const dwellProgress = ref(0)
const targetRefs = new Map<string, HTMLElement>()
const currentTarget = computed(() => targets[Math.min(stepIndex.value, targets.length - 1)]!)
const progressLabel = computed(() => `${Math.min(stepIndex.value + 1, targets.length)} / ${targets.length}`)

let dwellTimer: number | undefined
let dwellStartedAt = 0
let progressFrame: number | undefined
let prepareTimer: number | undefined

function setTargetRef(id: string, element: unknown) {
  if (element instanceof HTMLElement) targetRefs.set(id, element)
  else targetRefs.delete(id)
}

function bridge() {
  return (window as Window & { __ireadTobiiGazeBridge?: BridgeControls }).__ireadTobiiGazeBridge
}

function wait(durationMs: number) {
  return new Promise((resolve) => {
    prepareTimer = window.setTimeout(resolve, durationMs)
  })
}

async function waitForBridge(timeoutMs = 1800) {
  const startedAt = performance.now()
  let controls = bridge()

  while (!controls && performance.now() - startedAt < timeoutMs) {
    await wait(60)
    controls = bridge()
  }

  return controls
}

async function prepareCalibration() {
  const controls = await waitForBridge()

  if (!controls) {
    status.value = 'error'
    errorMessage.value = 'Tobii gaze bridge 연결을 확인해 주세요.'
    return
  }

  controls.resetTransform()
  controls.clearAnchors()
  controls.clearRecentSamples?.()
  controls.resetHeadPoseBaseline?.()
}

function clearDwell() {
  if (dwellTimer !== undefined) window.clearTimeout(dwellTimer)
  if (progressFrame !== undefined) window.cancelAnimationFrame(progressFrame)
  dwellTimer = undefined
  progressFrame = undefined
  dwellStartedAt = 0
  dwellProgress.value = 0
  if (status.value === 'dwelling') status.value = 'ready'
}

function updateProgress() {
  if (dwellStartedAt === 0) return
  dwellProgress.value = Math.min(1, (performance.now() - dwellStartedAt) / DWELL_CAPTURE_MS)
  if (dwellProgress.value < 1) progressFrame = window.requestAnimationFrame(updateProgress)
}

function pointInsideCurrentTarget(clientX: number, clientY: number) {
  const element = targetRefs.get(currentTarget.value.id)
  if (!element) return false

  const rect = element.getBoundingClientRect()
  return (
    clientX >= rect.left - HIT_PADDING
    && clientX <= rect.right + HIT_PADDING
    && clientY >= rect.top - HIT_PADDING
    && clientY <= rect.bottom + HIT_PADDING
  )
}

function beginAutoCapture() {
  if (status.value !== 'ready') return
  bridge()?.clearRecentSamples?.()
  status.value = 'dwelling'
  dwellStartedAt = performance.now()
  updateProgress()
  dwellTimer = window.setTimeout(() => {
    void sampleCurrentTarget()
  }, DWELL_CAPTURE_MS)
}

function onGaze(event: Event) {
  if (!['ready', 'dwelling'].includes(status.value)) return

  const detail = (event as CustomEvent<GazeEventDetail>).detail
  const clientX = typeof detail?.rawClientX === 'number'
    ? detail.rawClientX
    : typeof detail?.clientX === 'number'
      ? detail.clientX
      : detail?.x
  const clientY = typeof detail?.rawClientY === 'number'
    ? detail.rawClientY
    : typeof detail?.clientY === 'number'
      ? detail.clientY
      : detail?.y

  if (typeof clientX !== 'number' || typeof clientY !== 'number') return

  if (pointInsideCurrentTarget(clientX, clientY)) beginAutoCapture()
  else clearDwell()
}

async function sampleCurrentTarget() {
  const controls = bridge()
  const target = currentTarget.value
  const element = targetRefs.get(target.id)

  if (!controls || !element) {
    status.value = 'error'
    errorMessage.value = '시선 추적 연결을 확인해 주세요.'
    clearDwell()
    return
  }

  if (status.value === 'sampling') return
  clearDwell()
  status.value = 'sampling'
  errorMessage.value = ''

  try {
    await nextTick()
    await controls.sampleAnchor(`story-${target.id}`, element, SAMPLE_MS)

    if (stepIndex.value < targets.length - 1) {
      stepIndex.value += 1
      status.value = 'ready'
      return
    }

    controls.fitAnchors('story-left', 'story-right', 'story-top', 'story-bottom')
    status.value = 'complete'
  } catch (error) {
    status.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : '시선 위치 맞추기에 실패했어요.'
  }
}

function close() {
  emit('close')
}

function retryCalibration() {
  const controls = bridge()
  controls?.resetTransform()
  controls?.clearAnchors()
  controls?.clearRecentSamples?.()
  controls?.resetHeadPoseBaseline?.()
  clearDwell()
  stepIndex.value = 0
  status.value = 'ready'
  errorMessage.value = ''
}

onMounted(() => {
  window.addEventListener('iread:gaze', onGaze)
  void fetchGazeCalibrationGuide()
    .then((guide) => {
      if (guide.calibrationGuide.trim()) guideMessage.value = guide.calibrationGuide
    })
    .catch(() => {
      // 로컬 보정은 서버 안내 조회 실패와 관계없이 진행할 수 있다.
    })
  void prepareCalibration()
})
onBeforeUnmount(() => {
  if (prepareTimer !== undefined) window.clearTimeout(prepareTimer)
  clearDwell()
  window.removeEventListener('iread:gaze', onGaze)
})
</script>

<template>
  <div class="gaze-calibration-overlay" role="dialog" aria-modal="true" aria-labelledby="gaze-calibration-title" @click.self="close">
    <section class="calibration-frame" aria-labelledby="gaze-calibration-title">
      <img :src="storyScene" alt="" />
      <div class="scene-shade" aria-hidden="true" />

      <header class="calibration-header" :class="{ hidden: currentTarget.id === 'top' && status !== 'complete' }">
        <p>{{ progressLabel }}</p>
        <h1 id="gaze-calibration-title">시선 위치 맞추기</h1>
        <span>{{ guideMessage }}</span>
      </header>

      <div class="target-layer" aria-hidden="true">
        <button
          v-for="target in targets"
          :key="target.id"
          :ref="(element) => setTargetRef(target.id, element)"
          class="target-dot"
          :class="{
            active: currentTarget.id === target.id && !['complete', 'sampling'].includes(status),
            done: targets.findIndex((item) => item.id === target.id) < stepIndex || status === 'complete',
            sampling: currentTarget.id === target.id && status === 'sampling',
            dwelling: currentTarget.id === target.id && status === 'dwelling',
          }"
          type="button"
          :style="{ ...target.style, '--progress': `${dwellProgress * 360}deg` }"
          tabindex="-1"
        >
          <span>{{ target.label }}</span>
        </button>
      </div>

      <footer class="calibration-actions">
        <p v-if="status === 'ready'">{{ currentTarget.label }} 점을 바라봐 주세요.</p>
        <p v-else-if="status === 'dwelling'">좋아요, 그대로 바라봐 주세요.</p>
        <p v-else-if="status === 'sampling'">시선 샘플을 모으고 있어요.</p>
        <p v-else-if="status === 'complete'">시선 위치 맞추기가 끝났어요.</p>
        <p v-else class="error">{{ errorMessage }}</p>

        <div>
          <button v-if="status !== 'complete'" class="secondary" type="button" @click="close">건너뛰기</button>
          <button v-if="status === 'error'" class="secondary" type="button" @click="retryCalibration">다시 시작</button>
          <button v-if="status !== 'complete'" class="primary" type="button" :disabled="status === 'sampling'" @click="sampleCurrentTarget">
            {{ status === 'sampling' ? '측정 중' : '수동 저장' }}
          </button>
          <button v-else class="primary" type="button" @click="close">완료</button>
        </div>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.gaze-calibration-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:clamp(10px,1.5vh,18px) var(--learner-page-padding);background:rgb(32 49 86 / 55%);backdrop-filter:blur(4px);color:var(--learner-color-text);font-family:var(--learner-font-reading)}
.calibration-frame{position:relative;width:min(94vw,1520px);height:min(97%,850px);min-height:0;overflow:hidden;border:var(--learner-border-width-strong) solid rgba(255,255,255,.86);border-radius:34px;background:#d6edff;box-shadow:var(--learner-shadow-floating)}
.calibration-frame>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.scene-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,252,226,.18),rgba(32,49,86,.24));pointer-events:none}
.calibration-header{position:absolute;z-index:2;top:clamp(22px,4vh,42px);left:50%;display:grid;justify-items:center;gap:8px;width:min(80%,680px);padding:18px 26px;border:4px solid rgba(255,255,255,.8);border-radius:28px;background:rgba(255,253,239,.94);box-shadow:0 12px 34px rgba(47,80,120,.2);transform:translateX(-50%);text-align:center}
.calibration-header.hidden{opacity:0;pointer-events:none}
.calibration-header p,.calibration-header span{margin:0;color:#4d668a;font-weight:800}.calibration-header h1{margin:0;color:#243f7c;font-family:var(--learner-font-display);font-size:clamp(32px,3.5vw,50px);font-weight:900}
.target-layer{position:absolute;inset:0;z-index:1}.target-dot{--progress:0deg;position:absolute;display:grid;place-items:center;width:112px;height:112px;border:6px solid rgba(255,255,255,.88);border-radius:50%;background:rgba(255,241,144,.88);color:#243f7c;box-shadow:0 10px 28px rgba(45,80,120,.2),0 0 0 0 rgba(90,190,255,.2);font-family:var(--learner-font-display);font-size:22px;font-weight:900;transform:translate(-50%,-50%);transition:opacity .18s,transform .18s,background .18s,box-shadow .18s}
.target-dot::after{position:absolute;inset:-15px;border-radius:50%;background:conic-gradient(#5cc7ff var(--progress),transparent 0);content:"";opacity:0;pointer-events:none;-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 7px),#000 0);mask:radial-gradient(farthest-side,transparent calc(100% - 7px),#000 0)}
.target-dot:not(.active):not(.done):not(.sampling){opacity:.45}.target-dot.active{background:#fff4a8;box-shadow:0 12px 32px rgba(45,80,120,.26),0 0 0 18px rgba(93,200,255,.22);animation:target-pulse 1.05s ease-in-out infinite}.target-dot.dwelling::after{opacity:1}.target-dot.sampling{background:#8fe7ff}.target-dot.done{background:#dcf7d6;color:#2c7040;opacity:.9}
.calibration-actions{position:absolute;z-index:3;right:clamp(26px,4vw,58px);bottom:clamp(24px,4vh,52px);display:grid;gap:14px;width:min(90%,560px);padding:22px 24px;border:4px solid rgba(255,255,255,.9);border-radius:28px;background:rgba(255,253,239,.96);box-shadow:0 14px 38px rgba(40,65,95,.25)}
.calibration-actions p{margin:0;color:#293f6f;font-size:20px;font-weight:850;line-height:1.45}.calibration-actions .error{color:#b74848}.calibration-actions div{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:12px}
.calibration-actions button{min-height:54px;padding:0 24px;border:0;border-radius:18px;font-family:var(--learner-font-display);font-size:20px;font-weight:900;cursor:pointer}.calibration-actions button:disabled{opacity:.55;cursor:wait}.primary{background:#5d6fe8;color:#fff;box-shadow:0 6px 0 #4454c9}.secondary{background:#eef3ff;color:#344f8d}
@keyframes target-pulse{50%{transform:translate(-50%,-50%) scale(1.06);box-shadow:0 12px 32px rgba(45,80,120,.26),0 0 0 26px rgba(93,200,255,.12)}}
@media(max-width:760px){.target-dot{width:88px;height:88px;font-size:18px}.calibration-header{top:16px}.calibration-actions{right:16px;bottom:16px}}
@media(prefers-reduced-motion:reduce){.target-dot.active{animation:none}}
</style>
