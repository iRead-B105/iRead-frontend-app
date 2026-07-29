<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import storyChoiceScene from '../../assets/story/story-choice-turtle-crossroads.png'
import { getStoryDetail, unlockStoryFriend } from '@/services/learnerDataRepository'
import PageBackButton from '@/components/common/PageBackButton.vue'
import type { VillageItem } from '@/types/village'
import { learnerDataSource } from '@/config/learnerDataSource'

interface StoryPage { lines: string[]; image: string; imagePosition?: string }
interface Story { title: string; character: string; question: string; pages: StoryPage[] }

interface SpeechRecognitionResultLike { 0?: { transcript?: string } }
interface SpeechRecognitionEventLike { results?: ArrayLike<SpeechRecognitionResultLike> }
interface SpeechRecognitionErrorLike { error: string }
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

const route = useRoute()
const router = useRouter()
const storyId = computed(() => String(route.params.storyId ?? 'alice'))
const story = ref<Story>({
  title: '이야기를 불러오는 중',
  character: '이야기 친구',
  question: '다음에는 어떤 일이 일어날까요?',
  pages: [{ image: storyChoiceScene, lines: ['이야기를 준비하고 있어요.'] }],
})
const loadError = ref('')
const branchIntegrationError = ref('')

async function loadStory() {
  loadError.value = ''
  try {
    const detail = await getStoryDetail(storyId.value)
    story.value = {
    title: detail.title,
    character: detail.character,
    question: detail.branchQuestion,
    pages: detail.pages.map((page) => ({
      image: page.imageUrl,
      imagePosition: page.imagePosition,
      lines: [...page.lines],
    })),
    }
  } catch {
    loadError.value = '이야기를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
  }
}
const storageKey = computed(() => `iread-story-page:${storyId.value}`)
const generatedStorageKey = computed(() => `iread-story-generated:${storyId.value}`)

function loadGeneratedPages(): StoryPage[] {
  if (route.query.continue !== '1') return []
  try {
    const saved = JSON.parse(window.localStorage.getItem(generatedStorageKey.value) ?? '[]') as Array<{ lines?: unknown; imagePosition?: unknown }>
    return saved
      .filter((item) => Array.isArray(item.lines) && item.lines.every((line) => typeof line === 'string'))
      .map((item) => ({ lines: item.lines as string[], image: story.value.pages.at(-1)!.image, imagePosition: typeof item.imagePosition === 'string' ? item.imagePosition : story.value.pages.at(-1)?.imagePosition }))
  } catch {
    return []
  }
}

function initialPage() {
  if (route.query.continue !== '1') return 0
  const saved = Number(window.localStorage.getItem(storageKey.value) ?? 0)
  return Number.isInteger(saved) ? Math.min(Math.max(saved, 0), allPages.value.length - 1) : 0
}

const currentPage = ref(0)
const generatedPages = ref<StoryPage[]>([])
const screen = ref<'reading' | 'question' | 'generating' | 'reward'>('reading')
const rewardedFriend = ref<VillageItem | null>(null)
const readThrough = ref(-1)
const gaze = ref({ x: 0, y: 0, visible: false })
const showReturnCue = ref(false)
const textPanel = ref<HTMLElement | null>(null)
const dwellTargetIndex = ref<number | null>(null)
const dwellDurationMs = ref(100)
const transcript = ref('')
const isListening = ref(false)
const speechError = ref(false)
let leaveTimer: number | undefined
let dwellTimer: number | undefined
let generationTimer: number | undefined
let silenceRetryTimer: number | undefined
let recognition: SpeechRecognitionLike | null = null
let lastExternalGazeAt = 0

const WORD_HIT_PADDING_X = 18
const WORD_HIT_PADDING_Y = 24

const allPages = computed(() => [...story.value.pages, ...generatedPages.value])
const page = computed<StoryPage>(() => allPages.value[currentPage.value] ?? story.value.pages[0]!)
const pageWords = computed(() => page.value.lines.flatMap((line, lineIndex) => line.split(' ').map((word) => ({ word, lineIndex }))))
const isLastPage = computed(() => currentPage.value === allPages.value.length - 1)
const isPageRead = computed(() => readThrough.value >= pageWords.value.length - 1)
function getSpeechRecognitionConstructor() {
  const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}

function setMicrophoneState(active: boolean, available?: boolean) {
  window.dispatchEvent(new CustomEvent('iread:microphone-state', {
    detail: { active, ...(typeof available === 'boolean' ? { available } : {}) },
  }))
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
  if (isLastPage.value) {
    if (generatedPages.value.length > 0) {
      clearDwell()
      clearLeaveTimer()
      gaze.value.visible = false
      rewardedFriend.value = await unlockStoryFriend(storyId.value)
      screen.value = 'reward'
      return
    }
    if (learnerDataSource === 'api') {
      branchIntegrationError.value =
        '이야기 분기 음성을 audioFile로 보내는 녹음 UI 연결이 필요합니다.'
      return
    }
    clearDwell()
    clearLeaveTimer()
    gaze.value.visible = false
    transcript.value = ''
    speechError.value = false
    screen.value = 'question'
    await nextTick()
    startListening()
    return
  }
  currentPage.value += 1
  window.localStorage.setItem(storageKey.value, String(currentPage.value))
  readThrough.value = -1
  clearDwell()
  showReturnCue.value = false
  gaze.value.visible = false
  clearLeaveTimer()
  await nextTick()
}

function startListening() {
  if (silenceRetryTimer !== undefined) window.clearTimeout(silenceRetryTimer)
  silenceRetryTimer = undefined
  speechError.value = false
  isListening.value = true
  setMicrophoneState(true)

  const Recognition = getSpeechRecognitionConstructor()
  if (!Recognition) {
    // 실제 앱에서는 연결된 STT 장치가 iread:speech 이벤트를 전달합니다.
    return
  }

  recognition?.stop()
  recognition = new Recognition()
  recognition.lang = 'ko-KR'
  recognition.continuous = false
  recognition.interimResults = false
  recognition.onresult = (event) => {
    const answer = event.results?.[0]?.[0]?.transcript?.trim()
    if (answer) {
      setMicrophoneState(false, true)
      acceptAnswer(answer)
    }
  }
  recognition.onerror = (event) => {
    isListening.value = false
    speechError.value = true
    const unavailable = ['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)
    setMicrophoneState(false, unavailable ? false : undefined)
  }
  recognition.onend = () => {
    isListening.value = false
    setMicrophoneState(false)
    if (screen.value === 'question' && !speechError.value) {
      speechError.value = true
      silenceRetryTimer = window.setTimeout(() => {
        if (screen.value === 'question') startListening()
      }, 1400)
    }
  }
  recognition.start()
}

function stopListening() {
  recognition?.stop()
  isListening.value = false
  setMicrophoneState(false)
}

function onExternalSpeech(event: Event) {
  if (screen.value !== 'question') return
  const detail = (event as CustomEvent<{ transcript?: string; text?: string }>).detail
  const answer = (detail?.transcript ?? detail?.text ?? '').trim()
  if (answer) {
    speechError.value = false
    setMicrophoneState(false)
    acceptAnswer(answer)
  }
}

function acceptAnswer(answer: string) {
  transcript.value = answer
  screen.value = 'generating'
  stopListening()
  generationTimer = window.setTimeout(() => appendGeneratedPage(answer), 1400)
}

function appendGeneratedPage(answer: string) {
  const shortAnswer = answer.replace(/[“”"]/g, '').slice(0, 28)
  const nextPage: StoryPage = {
    image: story.value.pages.at(-1)!.image,
    imagePosition: story.value.pages.at(-1)?.imagePosition,
    lines: [
      `아이의 생각은 “${shortAnswer}”였어요.`,
      `${story.value.character}의 새 이야기가 시작됐지요.`,
      `${story.value.character}는 용기를 내어 앞으로 나아갔어요.`,
    ],
  }
  generatedPages.value.push(nextPage)
  window.localStorage.setItem(generatedStorageKey.value, JSON.stringify(generatedPages.value.map(({ lines, imagePosition }) => ({ lines, imagePosition }))))
  currentPage.value = allPages.value.length - 1
  window.localStorage.setItem(storageKey.value, String(currentPage.value))
  readThrough.value = -1
  transcript.value = ''
  screen.value = 'reading'
}

watch(storyId, async () => {
  await loadStory()
  generatedPages.value = loadGeneratedPages()
  currentPage.value = initialPage()
  screen.value = 'reading'
  rewardedFriend.value = null
  readThrough.value = -1
  clearDwell()
})
onMounted(async () => {
  await loadStory()
  generatedPages.value = loadGeneratedPages()
  currentPage.value = initialPage()
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('iread:gaze', onExternalGaze)
  window.addEventListener('iread:speech', onExternalSpeech)
})
onBeforeUnmount(() => {
  clearLeaveTimer()
  clearDwell()
  if (generationTimer !== undefined) window.clearTimeout(generationTimer)
  if (silenceRetryTimer !== undefined) window.clearTimeout(silenceRetryTimer)
  recognition?.stop()
  setMicrophoneState(false)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('iread:gaze', onExternalGaze)
  window.removeEventListener('iread:speech', onExternalSpeech)
})
</script>

<template>
  <main class="story-reader">
    <section class="reader-frame" :aria-label="`${story.title} 읽기`">
      <div v-if="screen === 'reading'" class="story-scene">
        <PageBackButton
          class="reader-back"
          label="이야기 나라로 돌아가기"
          @back="router.push({ name: 'stories' })"
        />
        <div class="story-progress" role="status" :aria-label="`현재 ${currentPage + 1}페이지, 전체 ${allPages.length}페이지`">
          {{ currentPage + 1 }} / {{ allPages.length }}
        </div>
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
          <span>{{ isLastPage ? (generatedPages.length ? '이야기 마치기' : '이야기 이어 만들기') : '다음 페이지' }}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
        </button>
      </div>

      <div v-else-if="screen === 'question' || screen === 'generating'" class="question-scene">
        <PageBackButton
          class="reader-back"
          label="이야기 나라로 돌아가기"
          @back="router.push({ name: 'stories' })"
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
              <span class="listening-mic" :class="{ 'listening-mic--active': isListening }" aria-hidden="true">
                <svg viewBox="0 0 48 48"><rect x="17" y="6" width="14" height="25" rx="7"/><path d="M11 23c0 8 5.8 14 13 14s13-6 13-14M24 37v7M17 44h14"/></svg>
              </span>
              <div class="listening-copy">
                <strong>{{ speechError ? '잘 듣지 못했어요' : '이야기를 들려주세요!' }}</strong>
                <p>{{ speechError ? '천천히 다시 말해 볼까요?' : '지금 대답을 듣고 있어요…' }}</p>
              </div>
              <button v-if="speechError" class="retry-button" type="button" @click="startListening">
                다시 말하기
              </button>
            </section>
          </template>

          <template v-else>
            <h1 class="making-title">다음 이야기를 만들고 있어요!</h1>
            <blockquote>“{{ transcript }}”</blockquote>
            <span class="making-dots" aria-label="다음 이야기 만드는 중"><i/><i/><i/></span>
          </template>
        </section>
      </div>

      <div v-else class="reward-scene">
        <section v-if="rewardedFriend" class="reward-card" aria-live="polite">
          <span class="reward-kicker">새로운 이야기 친구!</span>
          <div class="reward-character">
            <span class="reward-rays" aria-hidden="true" />
            <img :src="rewardedFriend.image" :alt="`${rewardedFriend.name} 캐릭터`" />
          </div>
          <h1>{{ rewardedFriend.name }}를 만났어요!</h1>
          <p>이야기를 끝까지 읽어서 새로운 친구가 찾아왔어요.</p>
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
