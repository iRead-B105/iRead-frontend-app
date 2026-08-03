<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import storyChoiceScene from '../../assets/story/story-choice-turtle-crossroads.png'
import {
  getCachedStudent,
  getStoryDetail,
  unlockStoryFriend,
} from '@/services/learnerDataRepository'
import PageBackButton from '@/components/common/PageBackButton.vue'
import type { VillageItem } from '@/types/village'
import { learnerStoryRepository } from '@/features/learner/story'
import {
  createMockVoiceFile,
  mockDeviceSubmissionsEnabled,
} from '@/features/learner/training'
import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import { useLearnerErrorModalStore } from '@/stores/learnerErrorModal'
import arrowRightIcon from '@/assets/icons/arrow-right.svg'
import microphoneIcon from '@/assets/icons/microphone.svg'
import checkIcon from '@/assets/icons/check.svg'

interface StoryPage {
  lineId: string
  lines: string[]
  image: string
  imagePosition?: string
  readAt: string | null
  requiresBranchInput: boolean
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
      image: page.imageUrl,
      imagePosition: page.imagePosition,
      lines: [...page.lines],
      readAt: page.readAt,
      requiresBranchInput: page.requiresBranchInput,
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
const speechError = ref(false)
const branchSubmitting = ref(false)
const mockBranchVoiceFile = ref<File | null>(null)
const ttsLoading = ref(false)
const ttsPlaying = ref(false)
let leaveTimer: number | undefined
let dwellTimer: number | undefined
let lastExternalGazeAt = 0
let narrationAudio: HTMLAudioElement | null = null
let narrationObjectUrl: string | null = null

const WORD_HIT_PADDING_X = 18
const WORD_HIT_PADDING_Y = 24

const allPages = computed(() => story.value.pages)
const page = computed<StoryPage>(() => allPages.value[currentPage.value] ?? story.value.pages[0]!)
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

function updateGaze(clientX: number, clientY: number, canRead = true) {
  if (screen.value !== 'reading') return
  const panel = textPanel.value
  if (!panel) return
  const panelRect = panel.getBoundingClientRect()
  gaze.value = { x: clientX - panelRect.left, y: clientY - panelRect.top, visible: clientX >= panelRect.left && clientX <= panelRect.right && clientY >= panelRect.top && clientY <= panelRect.bottom }
  if (!gaze.value.visible) { clearDwell(); scheduleReturnCue(); return }
  if (!canRead) { clearDwell(); return }
  const targetIndex = wordIndexAt(clientX, clientY)
  if (targetIndex !== null) beginDwell(targetIndex)
  else clearDwell()
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
    readThrough.value = -1
    clearDwell()
    showReturnCue.value = false
    gaze.value.visible = false
    clearLeaveTimer()
    await nextTick()
  } catch (error) {
    errorModal.show(
      error instanceof Error ? error : new Error('읽기 진행 상태를 저장하지 못했습니다.'),
      '이야기 진행 오류',
    )
  }
}

async function startListening() {
  speechError.value = false
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

async function submitBranchAnswer() {
  const current = page.value
  const blob = voiceRecorder.audioBlob.value
  const audioFile = mockBranchVoiceFile.value ?? (
    blob
      ? new File(
          [blob],
          `story-${current.lineId}.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`,
          { type: blob.type || 'audio/webm' },
        )
      : null
  )
  if (!current.lineId || !audioFile || branchSubmitting.value) {
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
      audioFile,
    )
    transcript.value = result.transcript
    await loadStory()
    const nextPageIndex = story.value.pages.findIndex(
      (item) => item.lineId === result.nextLineId,
    )
    currentPage.value = nextPageIndex >= 0
      ? nextPageIndex
      : Math.max(story.value.pages.length - 1, 0)
    readThrough.value = -1
    showReturnCue.value = false
    mockBranchVoiceFile.value = null
    voiceRecorder.reset()
    screen.value = 'reading'
    await nextTick()
  } catch (error) {
    screen.value = 'question'
    speechError.value = true
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
  await loadStory()
  currentPage.value = initialPage()
  screen.value = 'reading'
  rewardedFriend.value = null
  readThrough.value = -1
  voiceRecorder.reset()
  clearNarration()
  clearDwell()
})
onMounted(async () => {
  await loadStory()
  currentPage.value = initialPage()
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('iread:gaze', onExternalGaze)
})
onBeforeUnmount(() => {
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
            <h1>{{ story.question }}</h1>
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
                          ? '대답을 녹음했어요'
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
                          ? '이 답으로 다음 이야기를 만들 수 있어요.'
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
                  @click="submitBranchAnswer"
                >
                  이어 만들기
                  <img :src="checkIcon" alt="" aria-hidden="true" />
                </button>
              </div>
            </section>
          </template>

          <template v-else>
            <h1 class="making-title">다음 이야기를 만들고 있어요!</h1>
            <blockquote v-if="transcript">“{{ transcript }}”</blockquote>
            <p v-else>녹음한 대답을 이야기 서버에 보내고 있어요.</p>
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
