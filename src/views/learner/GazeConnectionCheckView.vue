<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { learnerContentRepository } from '@/features/learner/content'
import { learnerGazeRepository } from '@/features/learner/gaze'
import { getCachedStudent } from '@/services/learnerDataRepository'
import { useLearnerErrorModalStore } from '@/stores/learnerErrorModal'

interface GazeSample {
  readonly x: number
  readonly y: number
  readonly clientX?: number
  readonly clientY?: number
  readonly capturedAtMs: number
  readonly stable: boolean
}

const errorModal = useLearnerErrorModalStore()
const student = computed(() => getCachedStudent())
const storyId = ref('')
const gazeSessionId = ref('')
const analysisId = ref('')
const status = ref<'idle' | 'preparing' | 'running' | 'ending' | 'completed' | 'failed'>('idle')
const samples = ref<GazeSample[]>([])
const startedAtMs = ref(0)
const lastMessage = ref('Ready')

const sampleCount = computed(() => samples.value.length)
const durationMs = computed(() =>
  startedAtMs.value > 0 ? Math.max(0, Date.now() - startedAtMs.value) : 0,
)
const canStart = computed(() => status.value === 'idle' || status.value === 'completed' || status.value === 'failed')
const canEnd = computed(() => status.value === 'running' && sampleCount.value > 0)

function resetSessionState() {
  gazeSessionId.value = ''
  analysisId.value = ''
  samples.value = []
  startedAtMs.value = 0
}

async function resolveStoryId() {
  if (storyId.value) return storyId.value
  const library = await learnerContentRepository.getStoryLibrary(student.value.studentId)
  const existingStoryId = library.stories[0]?.storyId
  if (existingStoryId) {
    storyId.value = existingStoryId
    return existingStoryId
  }

  const templateId = library.templates[0]?.templateId
  if (!templateId) {
    throw new Error('시선 점검에 사용할 이야기 데이터가 없습니다.')
  }
  storyId.value = await learnerContentRepository.startStory(student.value.studentId, templateId)
  return storyId.value
}

async function startCheck() {
  resetSessionState()
  status.value = 'preparing'
  lastMessage.value = 'Preparing story session'

  try {
    const preparedStoryId = await resolveStoryId()
    const session = await learnerGazeRepository.start({
      studentId: student.value.studentId,
      contentType: 'STORY',
      storyId: preparedStoryId,
      calibrationStatus: 'SKIPPED',
    })
    gazeSessionId.value = session.gazeSessionId
    startedAtMs.value = Date.now()
    status.value = 'running'
    lastMessage.value = 'Collecting real gaze samples'
  } catch (error) {
    status.value = 'failed'
    lastMessage.value = 'Start failed'
    errorModal.show(error, 'Gaze check start failed')
  }
}

async function endCheck() {
  if (!gazeSessionId.value || samples.value.length === 0) return
  status.value = 'ending'
  lastMessage.value = 'Sending samples to backend'

  try {
    await learnerGazeRepository.end(
      gazeSessionId.value,
      student.value.studentId,
      'COMPLETED',
      {
        schemaVersion: 1,
        source: 'tobii-bridge-check',
        storyId: storyId.value,
        samples: samples.value,
      },
    )
    analysisId.value = await learnerGazeRepository.saveAnalysis(gazeSessionId.value, {
      studentId: student.value.studentId,
      totalVisitedDuration: durationMs.value,
      totalVisitedCount: samples.value.length,
      reverseReadCount: 0,
      avgVisitedDuration: samples.value.length > 0
        ? Math.round(durationMs.value / samples.value.length)
        : 0,
      sentenceMetrics: [],
    })
    status.value = 'completed'
    lastMessage.value = 'Saved gaze session and analysis result'
  } catch (error) {
    status.value = 'failed'
    lastMessage.value = 'End failed'
    errorModal.show(error, 'Gaze check end failed')
  }
}

function onGaze(event: Event) {
  if (status.value !== 'running') return
  const detail = (event as CustomEvent<Record<string, unknown>>).detail
  const x = typeof detail?.x === 'number'
    ? detail.x
    : typeof detail?.clientX === 'number'
      ? detail.clientX
      : null
  const y = typeof detail?.y === 'number'
    ? detail.y
    : typeof detail?.clientY === 'number'
      ? detail.clientY
      : null
  if (x === null || y === null) return

  samples.value = [
    ...samples.value.slice(-299),
    {
      x,
      y,
      clientX: typeof detail.clientX === 'number' ? detail.clientX : undefined,
      clientY: typeof detail.clientY === 'number' ? detail.clientY : undefined,
      capturedAtMs: Date.now(),
      stable: detail.headPoseStable !== false,
    },
  ]
}

window.addEventListener('iread:gaze', onGaze)
onBeforeUnmount(() => window.removeEventListener('iread:gaze', onGaze))
</script>

<template>
  <main class="gaze-check">
    <section class="gaze-check-panel">
      <header>
        <p>Gaze Connection Check</p>
        <h1>실제 시선 전송 점검</h1>
      </header>

      <dl class="gaze-check-grid">
        <div>
          <dt>student</dt>
          <dd>{{ student.studentId }}</dd>
        </div>
        <div>
          <dt>story</dt>
          <dd>{{ storyId || '-' }}</dd>
        </div>
        <div>
          <dt>session</dt>
          <dd>{{ gazeSessionId || '-' }}</dd>
        </div>
        <div>
          <dt>samples</dt>
          <dd>{{ sampleCount }}</dd>
        </div>
        <div>
          <dt>analysis</dt>
          <dd>{{ analysisId || '-' }}</dd>
        </div>
        <div>
          <dt>status</dt>
          <dd>{{ status }}</dd>
        </div>
      </dl>

      <p class="gaze-check-message">{{ lastMessage }}</p>

      <div class="gaze-check-actions">
        <button type="button" :disabled="!canStart" @click="startCheck">
          Start
        </button>
        <button type="button" :disabled="!canEnd" @click="endCheck">
          End and Save
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.gaze-check {
  display: grid;
  min-height: 100%;
  place-items: center;
  padding: 32px;
  background: #dff4ff;
}

.gaze-check-panel {
  width: min(720px, 100%);
  padding: 28px;
  border: 4px solid #ffffff;
  border-radius: 8px;
  background: #fffdf6;
  box-shadow: 0 18px 45px rgb(40 65 95 / 24%);
}

.gaze-check-panel header p {
  margin: 0 0 6px;
  color: #276b83;
  font-weight: 900;
}

.gaze-check-panel h1 {
  margin: 0 0 20px;
  color: #263f70;
  font-size: 32px;
}

.gaze-check-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

.gaze-check-grid div {
  min-width: 0;
  padding: 12px;
  border: 2px solid #d8e2f0;
  border-radius: 8px;
  background: #f7fbff;
}

.gaze-check-grid dt {
  color: #5a6b82;
  font-size: 14px;
  font-weight: 800;
}

.gaze-check-grid dd {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
  color: #10233f;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 20px;
  font-weight: 900;
}

.gaze-check-message {
  margin: 18px 0 0;
  color: #344766;
  font-weight: 900;
}

.gaze-check-actions {
  display: flex;
  gap: 12px;
  margin-top: 22px;
}

.gaze-check-actions button {
  min-width: 150px;
  min-height: 54px;
  border: 0;
  border-radius: 8px;
  background: #587dd8;
  color: #fff;
  font: inherit;
  font-size: 18px;
  font-weight: 900;
  cursor: pointer;
}

.gaze-check-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}
</style>
