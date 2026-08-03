<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import storyChoiceScene from '../../assets/story/story-choice-turtle-crossroads.png'
import storySceneFallback from '../../assets/story/story-reader-turtle-scene-mock.png'
import {
  getCachedStudent,
  getStoryDetail,
  unlockStoryFriend,
} from '@/services/learnerDataRepository'
import PageBackButton from '@/components/common/PageBackButton.vue'
import type { VillageItem } from '@/types/village'
import { learnerStoryRepository } from '@/features/learner/story'
import type { LearnerStoryBranchPrompt } from '@/features/learner/model'
import { learnerGazeRepository } from '@/features/learner/gaze'
import {
  createMockVoiceFile,
  mockDeviceSubmissionsEnabled,
} from '@/features/learner/training'
import { learnerDataSource } from '@/config/learnerDataSource'
import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import { useLearnerErrorModalStore } from '@/stores/learnerErrorModal'
import arrowRightIcon from '@/assets/icons/arrow-right.svg'
import microphoneIcon from '@/assets/icons/microphone.svg'
import checkIcon from '@/assets/icons/check.svg'

const MOCK_TRANSPARENT_SCENE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

const resolveStoryScene = (imageUrl: string | null): string =>
  !imageUrl || imageUrl === MOCK_TRANSPARENT_SCENE
    ? storySceneFallback
    : imageUrl

interface StoryPage {
  lineId: string
  lines: string[]
  image: string
  imagePosition?: string
  readAt: string | null
  requiresBranchInput: boolean
  branchPrompt: LearnerStoryBranchPrompt | null
}
interface Story {
  title: string
  character: string
  question: string
  status: 'UNREAD' | 'IN_PROGRESS' | 'COMPLETED'
  currentDay: number
  availableDay: number
  totalDays: number
  pagesPerDay: number
  dayComplete: boolean
  pages: StoryPage[]
}

const route = useRoute()
const router = useRouter()
const errorModal = useLearnerErrorModalStore()
const voiceRecorder = useVoiceRecorder()
const storyId = computed(() => String(route.params.storyId ?? 'alice'))
const story = ref<Story>({
  title: '이야기를 불러오는 중',
  character: '이야기 친구',
  question: '다음에는 어떤 일이 일어날까요?',
  status: 'IN_PROGRESS',
  currentDay: 1,
  availableDay: 1,
  totalDays: 10,
  pagesPerDay: 10,
  dayComplete: false,
  pages: [{
    lineId: '',
    image: storyChoiceScene,
    lines: ['이야기를 준비하고 있어요.'],
    readAt: null,
    requiresBranchInput: false,
    branchPrompt: null,
  }],
})
const loadError = ref('')

async function loadStory() {
  loadError.value = ''
  try {
    const detail = await getStoryDetail(storyId.value)
    story.value = {
    title: detail.title,
    character: detail.character,
    question: detail.branchQuestion,
    status: detail.status,
    currentDay: detail.currentDay,
    availableDay: detail.availableDay,
    totalDays: detail.totalDays,
    pagesPerDay: detail.pagesPerDay,
    dayComplete: detail.dayComplete,
    pages: detail.pages.map((page) => ({
      lineId: page.lineId,
      image: resolveStoryScene(page.imageUrl),
      imagePosition: page.imagePosition,
      lines: [...page.lines],
      readAt: page.readAt,
      requiresBranchInput: page.requiresBranchInput,
      branchPrompt: page.branchPrompt,
    })),
    }
  } catch (error) {
    loadError.value = '이야기를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
    errorModal.show(
      error instanceof Error ? error : new Error(loadError.value),
      '이야기 연결 오류',
    )
  }
}

function initialPage() {
  if (route.query.continue !== '1') return 0
  const firstUnreadPage = story.value.pages.findIndex((item) => item.readAt === null)
  return firstUnreadPage >= 0
    ? firstUnreadPage
    : Math.max(story.value.pages.length - 1, 0)
}

const currentPage = ref(0)
const screen = ref<'reading' | 'question' | 'generating' | 'dayComplete' | 'reward'>('reading')
const rewardedFriend = ref<VillageItem | null>(null)
const readThrough = ref(-1)
const gaze = ref({ x: 0, y: 0, visible: false })
const showReturnCue = ref(false)
const textPanel = ref<HTMLElement | null>(null)
const dwellTargetIndex = ref<number | null>(null)
const dwellDurationMs = ref(100)
const transcript = ref('')
const recognizedBranchIntent = ref('')
const speechError = ref(false)
const branchSubmitting = ref(false)
const mockBranchVoiceFile = ref<File | null>(null)
const ttsLoading = ref(false)
const ttsPlaying = ref(false)
const storyGazeSessionId = ref<string | null>(null)
const storyGazeSessionCompleted = ref(false)
const storyGazeStartedAtMs = ref(0)
type StoryGazeSample = {
  readonly x: number
  readonly y: number
  readonly capturedAtMs: number
  readonly pageNo: number
  readonly storyLineId: number
  readonly tokenIndex?: number
  readonly text?: string
}
const storyGazeSamples: StoryGazeSample[] = []
let leaveTimer: number | undefined
let dwellTimer: number | undefined
let lastExternalGazeAt = 0
let lastStoryGazeSampleAt = 0
let narrationAudio: HTMLAudioElement | null = null
let narrationObjectUrl: string | null = null

const WORD_HIT_PADDING_X = 18
const WORD_HIT_PADDING_Y = 24

const allPages = computed(() => story.value.pages)
const page = computed<StoryPage>(() => allPages.value[currentPage.value] ?? story.value.pages[0]!)
const branchQuestion = computed(() => page.value.lines.join(' ').trim() || story.value.question)
const branchOptions = computed(() => page.value.branchPrompt?.options ?? [])
const pageWords = computed(() => page.value.lines.flatMap((line, lineIndex) => line.split(' ').map((word) => ({ word, lineIndex }))))
const isLastPage = computed(() => currentPage.value === allPages.value.length - 1)
const isPageRead = computed(() => readThrough.value >= pageWords.value.length - 1)
const isListening = computed(() =>
  voiceRecorder.state.status === 'requesting'
  || voiceRecorder.state.status === 'recording',
)
const hasBranchRecording = computed(() =>
  mockBranchVoiceFile.value !== null || voiceRecorder.state.hasRecording,
)

function exitToStorySelection() {
  void router.push({ name: 'story-selection' })
}

function clearLeaveTimer() {
  if (leaveTimer !== undefined) window.clearTimeout(leaveTimer)
  leaveTimer = undefined
}

function clearDwell() {
  if (dwellTimer !== undefined) window.clearTimeout(dwellTimer)
  dwellTimer = undefined
  dwellTargetIndex.value = null
}

function getDwellDuration(word: string) {
  const readableCharacterCount = Array.from(word).filter((character) => /[\p{L}\p{N}]/u.test(character)).length
  return Math.max(450, Math.max(readableCharacterCount, 1) * 180)
}

function beginDwell(index: number) {
  if (index !== readThrough.value + 1) {
    clearDwell()
    return
  }
  if (dwellTargetIndex.value === index) return

  clearDwell()
  clearLeaveTimer()
  showReturnCue.value = false
  dwellTargetIndex.value = index
  dwellDurationMs.value = getDwellDuration(pageWords.value[index]?.word ?? '')
  dwellTimer = window.setTimeout(() => {
    if (dwellTargetIndex.value !== index) return
    setProgress(index)
  }, dwellDurationMs.value)
}

function scheduleReturnCue() {
  clearLeaveTimer()
  if (readThrough.value >= pageWords.value.length - 1) return
  leaveTimer = window.setTimeout(() => { showReturnCue.value = true }, 3000)
}

async function resetReadingProgressForPage() {
  readThrough.value = -1
  clearDwell()
  showReturnCue.value = false
  gaze.value.visible = false
  clearLeaveTimer()
  await nextTick()
  scheduleReturnCue()
}

function setProgress(index: number) {
  if (index === readThrough.value + 1) readThrough.value += 1
  clearDwell()
  showReturnCue.value = false
  clearLeaveTimer()
}

function wordIndexAt(clientX: number, clientY: number) {
  const panel = textPanel.value
  if (!panel) return null
  const expectedIndex = readThrough.value + 1

  const exactTarget = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-word-index]')
  if (
    exactTarget
    && panel.contains(exactTarget)
    && Number(exactTarget.dataset.wordIndex) === expectedIndex
  ) return expectedIndex

  const candidates = Array.from(panel.querySelectorAll<HTMLElement>('[data-word-index]'))
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        index: Number(element.dataset.wordIndex),
        inside: (
          clientX >= rect.left - WORD_HIT_PADDING_X
          && clientX <= rect.right + WORD_HIT_PADDING_X
          && clientY >= rect.top - WORD_HIT_PADDING_Y
          && clientY <= rect.bottom + WORD_HIT_PADDING_Y
        ),
        distance: Math.hypot(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2)),
      }
    })
    .filter((candidate) => candidate.index === expectedIndex && candidate.inside)
    .sort((a, b) => a.distance - b.distance)

  return candidates[0]?.index ?? null
}

function visibleWordIndexAt(clientX: number, clientY: number) {
  const panel = textPanel.value
  if (!panel) return null

  const exactTarget = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-word-index]')
  if (exactTarget && panel.contains(exactTarget)) {
    const exactIndex = Number(exactTarget.dataset.wordIndex)
    return Number.isInteger(exactIndex) ? exactIndex : null
  }

  const candidates = Array.from(panel.querySelectorAll<HTMLElement>('[data-word-index]'))
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        index: Number(element.dataset.wordIndex),
        inside: (
          clientX >= rect.left - WORD_HIT_PADDING_X
          && clientX <= rect.right + WORD_HIT_PADDING_X
          && clientY >= rect.top - WORD_HIT_PADDING_Y
          && clientY <= rect.bottom + WORD_HIT_PADDING_Y
        ),
        distance: Math.hypot(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2)),
      }
    })
    .filter((candidate) => Number.isInteger(candidate.index) && candidate.inside)
    .sort((a, b) => a.distance - b.distance)

  return candidates[0]?.index ?? null
}

function recordStoryGazeSample(clientX: number, clientY: number, tokenIndex: number | null) {
  if (learnerDataSource !== 'api' || !storyGazeSessionId.value) return
  const lineId = Number(page.value.lineId)
  if (!Number.isInteger(lineId) || lineId <= 0) return
  const capturedAtMs = Date.now()
  if (capturedAtMs - lastStoryGazeSampleAt < 80) return
  lastStoryGazeSampleAt = capturedAtMs
  const word = tokenIndex === null ? undefined : pageWords.value[tokenIndex]?.word
  storyGazeSamples.push({
    x: clientX,
    y: clientY,
    capturedAtMs,
    pageNo: currentPage.value + 1,
    storyLineId: lineId,
    tokenIndex: tokenIndex ?? undefined,
    text: word,
  })
}

function updateGaze(clientX: number, clientY: number, canRead = true) {
  if (screen.value !== 'reading') return
  const panel = textPanel.value
  if (!panel) return
  const panelRect = panel.getBoundingClientRect()
  gaze.value = { x: clientX - panelRect.left, y: clientY - panelRect.top, visible: clientX >= panelRect.left && clientX <= panelRect.right && clientY >= panelRect.top && clientY <= panelRect.bottom }
  if (!gaze.value.visible) { clearDwell(); scheduleReturnCue(); return }
  const visibleTokenIndex = visibleWordIndexAt(clientX, clientY)
  recordStoryGazeSample(clientX, clientY, visibleTokenIndex)
  if (!canRead) { clearDwell(); scheduleReturnCue(); return }
  const targetIndex = wordIndexAt(clientX, clientY)
  if (targetIndex !== null) beginDwell(targetIndex)
  else { clearDwell(); scheduleReturnCue() }
}

function onPointerMove(event: PointerEvent) {
  if (Date.now() - lastExternalGazeAt < 1500) return
  updateGaze(event.clientX, event.clientY)
}
function onPointerLeave() { gaze.value.visible = false; clearDwell(); scheduleReturnCue() }
function onExternalGaze(event: Event) {
  const detail = (event as CustomEvent<{
    x?: number
    y?: number
    clientX?: number
    clientY?: number
    headPoseStable?: boolean
  }>).detail
  const clientX = typeof detail?.clientX === 'number' ? detail.clientX : detail?.x
  const clientY = typeof detail?.clientY === 'number' ? detail.clientY : detail?.y
  if (typeof clientX === 'number' && typeof clientY === 'number') {
    lastExternalGazeAt = Date.now()
    updateGaze(clientX, clientY, detail.headPoseStable !== false)
  }
}

function storyLineText(current: StoryPage) {
  return current.lines.join(' ')
}

function sampleDwellMs(
  sample: StoryGazeSample,
  index: number,
  samples: readonly StoryGazeSample[],
) {
  const next = samples[index + 1]
  const previous = samples[index - 1]
  const gap = next
    ? next.capturedAtMs - sample.capturedAtMs
    : previous
      ? sample.capturedAtMs - previous.capturedAtMs
      : 80
  return Math.max(0, Math.min(Number.isFinite(gap) && gap > 0 ? gap : 80, 250))
}

const READ_DWELL_MS = 1_000
const FIXATION_DWELL_MS = 2_000
const MAX_SAMPLE_GAP_MS = 250

interface StoryReadableSegment {
  readonly tokenIndex: number
  readonly startMs: number
  readonly endMs: number
  readonly dwellMs: number
}

interface StoryReplayWordMetric {
  questionNo: number
  storyLineId: number
  tokenIndex: number
  text: string
  dwellMs: number
  visitCount: number
  skipped: boolean
  regressionCount: number
  firstSeenMs: number | null
  lastSeenMs: number | null
}

function storyTokens(current: StoryPage): string[] {
  return current.lines.flatMap((line) => line.trim().split(/\s+/).filter(Boolean))
}

function createStoryReadableSegments(
  samples: readonly StoryGazeSample[],
  tokenCount: number,
): StoryReadableSegment[] {
  const segments: StoryReadableSegment[] = []
  let activeSegment: StoryReadableSegment | null = null

  const finishSegment = () => {
    if (!activeSegment || activeSegment.dwellMs < READ_DWELL_MS) return
    segments.push(activeSegment)
  }

  samples.forEach((sample, sampleIndex) => {
    const tokenIndex = Number.isInteger(sample.tokenIndex)
      && Number(sample.tokenIndex) >= 0
      && Number(sample.tokenIndex) < tokenCount
      ? Number(sample.tokenIndex)
      : null
    const dwellMs = sampleDwellMs(sample, sampleIndex, samples)
    if (tokenIndex === null) {
      finishSegment()
      activeSegment = null
      return
    }
    const shouldContinueSegment =
      activeSegment
      && activeSegment.tokenIndex === tokenIndex
      && sample.capturedAtMs - activeSegment.endMs <= MAX_SAMPLE_GAP_MS

    if (!shouldContinueSegment) {
      finishSegment()
      activeSegment = {
        tokenIndex,
        startMs: sample.capturedAtMs,
        endMs: sample.capturedAtMs + dwellMs,
        dwellMs,
      }
      return
    }

    const currentSegment = activeSegment
    if (!currentSegment) return
    activeSegment = {
      tokenIndex: currentSegment.tokenIndex,
      startMs: currentSegment.startMs,
      endMs: sample.capturedAtMs + dwellMs,
      dwellMs: currentSegment.dwellMs + dwellMs,
    }
  })
  finishSegment()

  return segments
}

function createStoryPageWordMetrics(
  current: StoryPage,
  pageIndex: number,
): {
  lineId: number
  lineSamples: StoryGazeSample[]
  pageStartMs: number
  segments: StoryReadableSegment[]
  metrics: StoryReplayWordMetric[]
} | null {
  const lineId = Number(current.lineId)
  if (!Number.isInteger(lineId) || lineId <= 0) return null
  const tokens = storyTokens(current)
  const lineSamples = storyGazeSamples
    .filter((sample) => sample.storyLineId === lineId)
    .sort((first, second) => first.capturedAtMs - second.capturedAtMs)
  const metrics = tokens.map<StoryReplayWordMetric>((text, tokenIndex) => ({
    questionNo: pageIndex + 1,
    storyLineId: lineId,
    tokenIndex,
    text,
    dwellMs: 0,
    visitCount: 0,
    skipped: true,
    regressionCount: 0,
    firstSeenMs: null,
    lastSeenMs: null,
  }))
  if (lineSamples.length === 0 || tokens.length === 0) {
    return { lineId, lineSamples, pageStartMs: lineSamples[0]?.capturedAtMs ?? storyGazeStartedAtMs.value, segments: [], metrics }
  }

  const pageStartMs = lineSamples[0]!.capturedAtMs
  const segments = createStoryReadableSegments(lineSamples, tokens.length)
  let previousReadTokenIndex: number | null = null
  const skippedByJump = new Set<number>()

  const markSkippedWordsBefore = (tokenIndex: number) => {
    const startIndex = previousReadTokenIndex === null ? 0 : previousReadTokenIndex + 1
    if (tokenIndex <= startIndex) return
    for (let skippedIndex = startIndex; skippedIndex < tokenIndex; skippedIndex += 1) {
      const skippedMetric = metrics[skippedIndex]
      if (skippedMetric && skippedMetric.firstSeenMs === null) {
        skippedMetric.skipped = true
        skippedByJump.add(skippedIndex)
      }
    }
  }

  segments.forEach((segment) => {
    const metric = metrics[segment.tokenIndex]
    if (!metric) return
    const firstSeenMs = Math.max(0, Math.round(segment.startMs - pageStartMs))
    const lastSeenMs = Math.max(firstSeenMs, Math.round(segment.endMs - pageStartMs))
    markSkippedWordsBefore(segment.tokenIndex)
    metric.firstSeenMs = metric.firstSeenMs === null
      ? firstSeenMs
      : Math.min(metric.firstSeenMs, firstSeenMs)
    metric.lastSeenMs = metric.lastSeenMs === null
      ? lastSeenMs
      : Math.max(metric.lastSeenMs, lastSeenMs)
    metric.skipped = skippedByJump.has(segment.tokenIndex)
    if (previousReadTokenIndex !== null && segment.tokenIndex < previousReadTokenIndex) {
      metric.regressionCount += 1
    }
    previousReadTokenIndex = segment.tokenIndex
    if (segment.dwellMs >= FIXATION_DWELL_MS) {
      metric.dwellMs += Math.round(segment.dwellMs)
      metric.visitCount += 1
    }
  })

  return { lineId, lineSamples, pageStartMs, segments, metrics }
}

function createStoryGazeSubmission() {
  const storyNumericId = Number(storyId.value)
  const regressions: {
    fromTargetIndex: number
    fromTokenIndex: number
    toTargetIndex: number
    toTokenIndex: number
    offsetMs: number
  }[] = []
  const sentenceMetrics = story.value.pages.flatMap((current, index) => {
    const pageAnalysis = createStoryPageWordMetrics(current, index)
    if (!pageAnalysis || pageAnalysis.lineSamples.length === 0) return []
    const { lineId, lineSamples, pageStartMs, segments, metrics } = pageAnalysis
    let previousReadTokenIndex: number | null = null

    segments.forEach((segment) => {
      if (previousReadTokenIndex !== null && segment.tokenIndex < previousReadTokenIndex) {
        regressions.push({
          fromTargetIndex: index + 1,
          fromTokenIndex: previousReadTokenIndex,
          toTargetIndex: index + 1,
          toTokenIndex: segment.tokenIndex,
          offsetMs: Math.max(0, segment.startMs - pageStartMs),
        })
      }
      previousReadTokenIndex = segment.tokenIndex
    })

    const dwellDurationMs = metrics.reduce((sum, metric) => sum + metric.dwellMs, 0)
    const fixationCount = metrics.reduce((sum, metric) => sum + metric.visitCount, 0)
    const regressionCount = metrics.reduce((sum, metric) => sum + metric.regressionCount, 0)

    return [{
      storyLineId: lineId,
      sequenceNo: index + 1,
      surfaceText: storyLineText(current),
      dwellDurationMs,
      fixationCount,
      regressionCount,
      averageFixationTimeMs: fixationCount > 0 ? Math.round(dwellDurationMs / fixationCount) : 0,
      firstGazeOffsetMs: 0,
      lastGazeOffsetMs: Math.max(0, lineSamples[lineSamples.length - 1]!.capturedAtMs - pageStartMs),
    }]
  })

  return {
    schemaVersion: 1,
    contentType: 'STORY' as const,
    storyId: Number.isInteger(storyNumericId) ? storyNumericId : undefined,
    gazeSessionDurationMs: storyGazeStartedAtMs.value > 0
      ? Math.max(0, Date.now() - storyGazeStartedAtMs.value)
      : undefined,
    samples: storyGazeSamples,
    replayWords: createStoryReplayWords(),
    sentenceMetrics,
    regressions,
  }
}

function createStoryReplayWords() {
  return story.value.pages.flatMap((current, pageIndex) => {
    return createStoryPageWordMetrics(current, pageIndex)?.metrics ?? []
  })
}

function resetStoryGazeState() {
  storyGazeSessionId.value = null
  storyGazeSessionCompleted.value = false
  storyGazeStartedAtMs.value = 0
  storyGazeSamples.splice(0)
  lastStoryGazeSampleAt = 0
}

async function startStoryGazeSession() {
  if (learnerDataSource !== 'api' || storyGazeSessionId.value) return
  const storyNumericId = Number(storyId.value)
  if (!Number.isInteger(storyNumericId) || storyNumericId <= 0) return
  try {
    const session = await learnerGazeRepository.start({
      studentId: getCachedStudent().studentId,
      contentType: 'STORY',
      storyId: storyId.value,
      calibrationStatus: 'SKIPPED',
    })
    storyGazeSessionId.value = session.gazeSessionId
    storyGazeStartedAtMs.value = Date.now()
  } catch (error) {
    errorModal.show(
      error instanceof Error ? error : new Error('?댁빞湲??쒖꽑 ?섏쭛???쒖옉?섏? 紐삵뻽?듬땲??'),
      '?댁빞湲??쒖꽑 ?곌껐 ?ㅻ쪟',
    )
  }
}

async function finishStoryGazeSession() {
  if (
    learnerDataSource !== 'api'
    || !storyGazeSessionId.value
    || storyGazeSessionCompleted.value
  ) return
  const sessionId = storyGazeSessionId.value
  const studentId = getCachedStudent().studentId
  storyGazeSessionCompleted.value = true
  try {
    if (storyGazeSamples.length === 0) {
      await learnerGazeRepository.fail(sessionId, studentId)
      return
    }
    await learnerGazeRepository.end(
      sessionId,
      studentId,
      'COMPLETED',
      createStoryGazeSubmission(),
    )
  } catch (error) {
    storyGazeSessionCompleted.value = false
    errorModal.show(
      error instanceof Error ? error : new Error('?댁빞湲??쒖꽑 遺꾩꽍????ν븯吏 紐삵뻽?듬땲??'),
      '?댁빞湲??쒖꽑 ???ㅻ쪟',
    )
  }
}

async function goNext() {
  const current = page.value
  if (!current.lineId) return

  try {
    await learnerStoryRepository.markLineRead(
      getCachedStudent().studentId,
      storyId.value,
      current.lineId,
    )
    current.readAt = new Date().toISOString()

    if (current.requiresBranchInput) {
      await finishStoryGazeSession()
      clearDwell()
      clearLeaveTimer()
      gaze.value.visible = false
      transcript.value = ''
      speechError.value = false
      mockBranchVoiceFile.value = null
      voiceRecorder.reset()
      screen.value = 'question'
      return
    }

    if (isLastPage.value) {
      await finishStoryGazeSession()
      clearDwell()
      clearLeaveTimer()
      gaze.value.visible = false
      if (story.value.status !== 'COMPLETED') {
        screen.value = 'dayComplete'
        return
      }
      screen.value = 'reward'
      try {
        rewardedFriend.value = await unlockStoryFriend(storyId.value)
      } catch {
        // 이야기 완료는 서버에서 이미 확정됐다. 보상 캐릭터 조회 실패가 완료 화면을 막지 않는다.
        rewardedFriend.value = null
      }
      return
    }

    currentPage.value += 1
    await resetReadingProgressForPage()
  } catch (error) {
    errorModal.show(
      error instanceof Error ? error : new Error('읽기 진행 상태를 저장하지 못했습니다.'),
      '이야기 진행 오류',
    )
  }
}

async function startListening() {
  speechError.value = false
  recognizedBranchIntent.value = ''
  voiceRecorder.reset()
  if (mockDeviceSubmissionsEnabled) {
    mockBranchVoiceFile.value = createMockVoiceFile(5)
    return
  }
  mockBranchVoiceFile.value = null
  await voiceRecorder.start()
  if (
    voiceRecorder.state.status === 'denied'
    || voiceRecorder.state.status === 'unsupported'
  ) {
    speechError.value = true
  }
}

function stopListening() {
  voiceRecorder.stop()
}

async function showStoryReward() {
  clearDwell()
  clearLeaveTimer()
  voiceRecorder.reset()
  screen.value = 'reward'
  try {
    rewardedFriend.value = await unlockStoryFriend(storyId.value)
  } catch {
    rewardedFriend.value = null
  }
}

function branchAudioFile(): File | null {
  const current = page.value
  const blob = voiceRecorder.audioBlob.value
  return mockBranchVoiceFile.value ?? (
    blob
      ? new File(
          [blob],
          `story-${current.lineId}.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`,
          { type: blob.type || 'audio/webm' },
        )
      : null
  )
}

async function reviewBranchRecording() {
  const current = page.value
  const audioFile = branchAudioFile()
  if (!current.lineId || !audioFile || branchSubmitting.value) {
    speechError.value = true
    return
  }
  branchSubmitting.value = true
  speechError.value = false
  try {
    const result = await learnerStoryRepository.transcribeBranchIntent(
      getCachedStudent().studentId,
      storyId.value,
      current.lineId,
      audioFile,
    )
    transcript.value = result.transcript
    recognizedBranchIntent.value = result.accepted ? result.transcript : ''
    speechError.value = !result.accepted
  } catch (error) {
    speechError.value = true
    errorModal.show(
      error instanceof Error ? error : new Error('말한 내용을 확인하지 못했습니다.'),
      '음성 선택 확인 오류',
    )
  } finally {
    branchSubmitting.value = false
  }
}

async function submitBranchAnswer(optionNo?: number, freeIntent?: string) {
  const current = page.value
  const answer = optionNo ?? freeIntent
  if (!current.lineId || !answer || branchSubmitting.value) {
    speechError.value = true
    return
  }

  branchSubmitting.value = true
  speechError.value = false
  screen.value = 'generating'
  try {
    const result = await learnerStoryRepository.chooseDirection(
      getCachedStudent().studentId,
      storyId.value,
      current.lineId,
      answer,
    )
    transcript.value = result.transcript || branchOptions.value.find((option) => option.optionNo === optionNo)?.label || ''
    if (result.status === 'COMPLETED' || result.progress >= 100) {
      await showStoryReward()
      return
    }
    await loadStory()
    const nextPageIndex = story.value.pages.findIndex(
      (item) => item.lineId === result.nextLineId,
    )
    currentPage.value = nextPageIndex >= 0
      ? nextPageIndex
      : Math.max(story.value.pages.length - 1, 0)
    resetStoryGazeState()
    await startStoryGazeSession()
    await resetReadingProgressForPage()
    mockBranchVoiceFile.value = null
    recognizedBranchIntent.value = ''
    voiceRecorder.reset()
    screen.value = 'reading'
  } catch (error) {
    screen.value = 'question'
    // 버튼 선택 실패는 녹음 오류가 아니므로 음성 제출에만 재녹음을 안내한다.
    speechError.value = optionNo === undefined
    errorModal.show(
      error instanceof Error ? error : new Error('다음 이야기를 만들지 못했습니다.'),
      '이야기 분기 오류',
    )
  } finally {
    branchSubmitting.value = false
  }
}

function clearNarration() {
  narrationAudio?.pause()
  narrationAudio = null
  if (narrationObjectUrl) {
    URL.revokeObjectURL(narrationObjectUrl)
    narrationObjectUrl = null
  }
  ttsPlaying.value = false
}

async function playNarration() {
  if (!page.value.lineId || ttsLoading.value) return
  clearNarration()
  ttsLoading.value = true
  try {
    const result = await learnerStoryRepository.synthesizeLine(
      getCachedStudent().studentId,
      storyId.value,
      page.value.lineId,
    )
    const audioBlob = await learnerStoryRepository.downloadAudio(result.audioUrl)
    narrationObjectUrl = URL.createObjectURL(audioBlob)
    narrationAudio = new Audio(narrationObjectUrl)
    narrationAudio.onended = () => {
      ttsPlaying.value = false
    }
    narrationAudio.onerror = () => {
      ttsPlaying.value = false
      errorModal.show(new Error('이야기 음성을 재생하지 못했습니다.'), '이야기 듣기 오류')
    }
    ttsPlaying.value = true
    await narrationAudio.play()
  } catch (error) {
    clearNarration()
    errorModal.show(
      error instanceof Error ? error : new Error('이야기 음성을 불러오지 못했습니다.'),
      '이야기 듣기 오류',
    )
  } finally {
    ttsLoading.value = false
  }
}

watch(storyId, async () => {
  await finishStoryGazeSession()
  resetStoryGazeState()
  await loadStory()
  currentPage.value = initialPage()
  screen.value = 'reading'
  rewardedFriend.value = null
  voiceRecorder.reset()
  clearNarration()
  await startStoryGazeSession()
  await resetReadingProgressForPage()
})
onMounted(async () => {
  await loadStory()
  currentPage.value = initialPage()
  await startStoryGazeSession()
  await resetReadingProgressForPage()
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('iread:gaze', onExternalGaze)
})
onBeforeRouteLeave(async () => {
  await finishStoryGazeSession()
})
onBeforeUnmount(() => {
  void finishStoryGazeSession()
  clearLeaveTimer()
  clearDwell()
  clearNarration()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('iread:gaze', onExternalGaze)
})
</script>

<template>
  <main class="story-reader">
    <section class="reader-frame" :aria-label="`${story.title} 읽기`">
      <div v-if="screen === 'reading'" class="story-scene">
        <PageBackButton
          class="reader-back"
          label="이야기 나라로 돌아가기"
          @back="exitToStorySelection"
        />
        <div class="story-progress" role="status" :aria-label="`${story.currentDay}일차 ${(currentPage % story.pagesPerDay) + 1}페이지`">
          {{ story.currentDay }}일차 · {{ (currentPage % story.pagesPerDay) + 1 }} / {{ story.pagesPerDay }}
        </div>
        <button
          class="story-listen"
          type="button"
          :disabled="ttsLoading"
          @click="playNarration"
        >
          {{ ttsLoading ? '음성 준비 중…' : ttsPlaying ? '다시 듣기' : '이야기 듣기' }}
        </button>
        <img :src="page.image" :alt="`${story.title} 이야기 장면`" :style="{ objectPosition: page.imagePosition ?? 'center' }" />
        <div class="scene-shade" aria-hidden="true" />
        <div ref="textPanel" class="reading-panel" aria-live="polite" @pointerleave="onPointerLeave">
          <div class="story-lines">
            <p v-for="(line, lineIndex) in page.lines" :key="line">
              <template v-for="(item, index) in pageWords" :key="`${lineIndex}-${index}`">
                <span v-if="item.lineIndex === lineIndex" class="story-word" :class="{ 'story-word--read': index <= readThrough, 'story-word--next': showReturnCue && index === readThrough + 1 }" :data-word-index="index">{{ item.word }}</span>
              </template>
            </p>
          </div>
        </div>
        <button v-if="isPageRead" class="next-page story-next" type="button" @click="goNext">
          <span>{{ page.requiresBranchInput ? '이야기 이어 만들기' : isLastPage ? '이야기 마치기' : '다음 페이지' }}</span>
          <img :src="arrowRightIcon" alt="" aria-hidden="true" />
        </button>
      </div>

      <div v-else-if="screen === 'question' || screen === 'generating'" class="question-scene">
        <PageBackButton
          class="reader-back"
          label="이야기 나라로 돌아가기"
          @back="exitToStorySelection"
        />
        <img :src="page.image" alt="" :style="{ objectPosition: page.imagePosition ?? 'center' }" />
        <div class="question-backdrop" aria-hidden="true" />
        <section class="question-card" :class="{ 'question-card--generating': screen === 'generating' }" aria-live="polite">
          <template v-if="screen === 'question'">
            <div class="choice-illustration">
              <img :src="storyChoiceScene" alt="갈림길 앞에서 어느 길로 갈지 고민하는 거북이" />
            </div>
            <h1>{{ branchQuestion }}</h1>
            <div v-if="branchOptions.length === 3" class="branch-options" aria-label="이야기 선택지">
              <button
                v-for="option in branchOptions"
                :key="option.optionNo"
                type="button"
                :disabled="branchSubmitting"
                @click="submitBranchAnswer(option.optionNo)"
              >
                {{ option.label }}
              </button>
            </div>
            <p class="branch-or">버튼을 누르거나 말로 이야기해 주세요.</p>
            <section class="voice-answer" aria-label="말로 대답하기">
              <button
                class="listening-mic"
                :class="{ 'listening-mic--active': isListening }"
                type="button"
                :disabled="branchSubmitting"
                :aria-label="isListening ? '녹음 끝내기' : '녹음 시작하기'"
                @click="isListening ? stopListening() : startListening()"
              >
                <img :src="microphoneIcon" alt="" aria-hidden="true" />
              </button>
              <div class="listening-copy">
                <strong>
                  {{
                    speechError
                      ? '녹음 내용을 확인해 주세요'
                      : isListening
                        ? '이야기를 듣고 있어요!'
                        : hasBranchRecording
                          ? (recognizedBranchIntent ? '말한 내용을 확인해 주세요' : '대답을 녹음했어요')
                          : '이야기를 들려주세요!'
                  }}
                </strong>
                <p>
                  {{
                    speechError
                      ? (voiceRecorder.state.errorMessage ?? '다시 녹음해 볼까요?')
                      : isListening
                        ? '말을 마치면 마이크를 눌러 주세요.'
                        : hasBranchRecording
                          ? (recognizedBranchIntent || '먼저 말한 내용을 글자로 확인해요.')
                          : '마이크를 누르고 대답해 주세요.'
                  }}
                </p>
              </div>
              <div class="voice-actions">
                <button
                  v-if="hasBranchRecording"
                  class="retry-button"
                  type="button"
                  :disabled="branchSubmitting"
                  @click="startListening"
                >
                  다시 말하기
                </button>
                <button
                  v-if="hasBranchRecording"
                  class="confirm-answer"
                  type="button"
                  :disabled="branchSubmitting"
                  @click="recognizedBranchIntent
                    ? submitBranchAnswer(undefined, recognizedBranchIntent)
                    : reviewBranchRecording()"
                >
                  <span>{{ recognizedBranchIntent ? '이 내용으로 이어 만들기' : '말한 내용 확인하기' }}</span>
                  <span class="confirm-answer-icon" aria-hidden="true">
                    <img :src="checkIcon" alt="" />
                  </span>
                </button>
              </div>
            </section>
          </template>

          <template v-else>
            <h1 class="making-title">다음 이야기를 만들고 있어요!</h1>
            <blockquote v-if="transcript">“{{ transcript }}”</blockquote>
            <p v-else>선택한 답으로 다음 이야기를 만들고 있어요.</p>
            <span class="making-dots" aria-label="다음 이야기 만드는 중"><i/><i/><i/></span>
          </template>
        </section>
      </div>

      <div v-else-if="screen === 'dayComplete'" class="reward-scene">
        <section class="reward-card" aria-live="polite">
          <span class="reward-kicker">{{ story.currentDay }}일차 완료!</span>
          <h1>오늘 이야기 10페이지를 다 읽었어요!</h1>
          <p>다음 이야기는 {{ Math.min(story.currentDay + 1, story.totalDays) }}일차에 이어져요.</p>
          <div class="reward-actions">
            <button type="button" @click="router.push({ name: 'story-selection' })">
              이야기 나라로
            </button>
          </div>
        </section>
      </div>

      <div v-else class="reward-scene">
        <section class="reward-card" aria-live="polite">
          <span class="reward-kicker">
            {{ rewardedFriend ? '새로운 이야기 친구!' : '이야기 완성!' }}
          </span>
          <div v-if="rewardedFriend" class="reward-character">
            <span class="reward-rays" aria-hidden="true" />
            <img :src="rewardedFriend.image" :alt="`${rewardedFriend.name} 캐릭터`" />
          </div>
          <h1>
            {{ rewardedFriend ? `${rewardedFriend.name}를 만났어요!` : '이야기를 끝까지 읽었어요!' }}
          </h1>
          <p>
            {{
              rewardedFriend
                ? '이야기를 끝까지 읽어서 새로운 친구가 찾아왔어요.'
                : '내가 선택한 내용으로 이야기가 완성됐어요.'
            }}
          </p>
          <div class="reward-actions">
            <button type="button" @click="router.push({ name: 'story-selection' })">
              이야기 나라로
            </button>
            <button type="button" @click="router.push({ name: 'growth' })">
              이야기 친구 보러 가기
            </button>
          </div>
        </section>
      </div>

    </section>
  </main>
</template>

<style scoped src="@/styles/story/StoryReaderView.css"></style>
