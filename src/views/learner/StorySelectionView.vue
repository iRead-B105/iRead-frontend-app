<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import storyLandBackground from '../../assets/backgrounds/story-section-background.png'
import aliceContinueScene from '../../assets/story/alice-continue.png'
import otherBooksIcon from '../../assets/story/ui/other-books-icon.png'
import newBookIcon from '../../assets/story/ui/new-book-icon.png'
import continueStoryIcon from '../../assets/story/ui/continue-story-icon.png'
import { fetchStoryLibrary, startStorySession } from '@/services/learnerDataRepository'
import PageBackButton from '@/components/common/PageBackButton.vue'

type StoryStatus = 'UNREAD' | 'IN_PROGRESS' | 'COMPLETED'
type LibraryMode = 'home' | 'other' | 'new'

interface StoryTemplate {
  id: string
  title: string
  coverImage: string
}

interface StorySession extends StoryTemplate {
  sessionId: string
  sessionNumber: number
  createdAt: string
  lastReadAt: string | null
  status: StoryStatus
  progress: number
}

const router = useRouter()
const mode = ref<LibraryMode>('home')

const storySessions = ref<StorySession[]>([])
const storyTemplates = ref<StoryTemplate[]>([])
const requestError = ref('')
const openingBookId = ref<string | null>(null)

onMounted(async () => {
  try {
    const library = await fetchStoryLibrary()
    storySessions.value = library.stories.map((story) => ({
    id: story.templateId,
    sessionId: story.storyId,
    sessionNumber: story.sessionNumber,
    createdAt: story.createdAt,
    lastReadAt: story.lastReadAt,
    title: story.title,
    coverImage: story.coverImageUrl,
    status: story.status,
    progress: story.progress,
    }))
    storyTemplates.value = library.templates.map((template) => ({
    id: template.templateId,
    title: template.title,
    coverImage: template.coverImageUrl,
    }))
  } catch {
    requestError.value = '이야기 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
  }
})

const currentBook = computed(() =>
  [...storySessions.value]
    .filter((book) => book.status === 'IN_PROGRESS')
    .sort((a, b) => {
      const aTime = Date.parse(a.lastReadAt ?? a.createdAt)
      const bTime = Date.parse(b.lastReadAt ?? b.createdAt)
      return bTime - aTime
    })[0],
)
const startedBooks = computed(() =>
  [...storySessions.value]
    .filter((book) => book.status !== 'UNREAD')
    .sort((a, b) => {
      const aTime = Date.parse(a.lastReadAt ?? a.createdAt)
      const bTime = Date.parse(b.lastReadAt ?? b.createdAt)
      return bTime - aTime
    }),
)
const visibleLibraryBooks = computed(() =>
  mode.value === 'other' ? startedBooks.value : storyTemplates.value,
)

function readingRoute(book: StoryTemplate, continueReading = false): RouteLocationRaw {
  const routeStoryId = (book as Partial<StorySession>).sessionId ?? book.id
  return {
    name: 'story-reading',
    params: { storyId: routeStoryId },
    query: continueReading ? { continue: '1' } : { new: '1' },
  }
}

function openCurrentBook() {
  if (currentBook.value) {
    void router.push(readingRoute(currentBook.value, true))
    return
  }
  mode.value = 'new'
}

async function openBook(book: StoryTemplate | StorySession) {
  const shouldContinue = 'status' in book && book.status === 'IN_PROGRESS'
  if (shouldContinue || 'sessionId' in book) {
    await router.push(readingRoute(book, shouldContinue))
    return
  }

  openingBookId.value = book.id
  requestError.value = ''
  try {
    const storyId = await startStorySession(book.id)
    await router.push({
      name: 'story-reading',
      params: { storyId },
      query: { new: '1' },
    })
  } catch {
    requestError.value = '새 이야기를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'
  } finally {
    openingBookId.value = null
  }
}

function progressLabel(book: StorySession) {
  if (book.status === 'COMPLETED') return '다 읽은 이야기'
  if (book.status === 'IN_PROGRESS') return `${book.progress}% 읽었어요`
  return ''
}

function sessionTitle(book: StorySession) {
  return `${book.title} ${book.sessionNumber}번째 이야기`
}
</script>

<template>
  <main
    class="story-library"
    :style="{ backgroundImage: `url(${storyLandBackground})` }"
  >
    <section class="library-panel" aria-labelledby="story-library-title">
      <template v-if="mode === 'home'">
        <header class="library-heading">
          <span aria-hidden="true">★</span>
          <h1 id="story-library-title">이야기 나라</h1>
          <span aria-hidden="true">★</span>
        </header>

        <button
          class="continue-card"
          :class="{ 'continue-card--empty': !currentBook }"
          type="button"
          @click="openCurrentBook"
        >
          <template v-if="currentBook">
            <img class="continue-scene" :src="aliceContinueScene" :alt="`${sessionTitle(currentBook)} 이어 읽기 장면`" />
            <span class="continue-kicker">이어서 읽기</span>
            <span class="continue-progress">{{ currentBook.progress }}%</span>
            <span class="continue-overlay">
              <strong>{{ sessionTitle(currentBook) }}</strong>
              <img :src="continueStoryIcon" alt="" aria-hidden="true" />
            </span>
          </template>
          <template v-else>
            <span class="empty-story-art" aria-hidden="true">
              <span class="empty-story-spark empty-story-spark--one">★</span>
              <span class="empty-story-spark empty-story-spark--two">●</span>
              <img :src="newBookIcon" alt="" />
            </span>
            <span class="empty-story-copy">
              <small>아직 읽고 있는 책이 없어요</small>
              <strong>새 이야기를 만나러 가요!</strong>
              <b>마음에 드는 첫 번째 책을 골라 보세요</b>
            </span>
            <span class="empty-story-action">
              <span>책 고르기</span>
              <img :src="continueStoryIcon" alt="" aria-hidden="true" />
            </span>
          </template>
        </button>

        <div class="library-actions">
          <button type="button" @click="mode = 'other'">
            <img class="action-icon" :src="otherBooksIcon" alt="" aria-hidden="true" />
            <span><strong>읽던 책 고르기</strong><small>읽던 책과 다 읽은 책 보기</small></span>
          </button>
          <button type="button" @click="mode = 'new'">
            <img class="action-icon" :src="newBookIcon" alt="" aria-hidden="true" />
            <span><strong>새 이야기 시작하기</strong><small>새로운 이야기를 처음부터 만들기</small></span>
          </button>
        </div>
      </template>

      <template v-else>
        <header class="catalog-heading">
          <PageBackButton label="이야기 나라 처음으로" @back="mode = 'home'" />
          <div>
            <small>{{ mode === 'other' ? '나의 책장' : '새 이야기 고르기' }}</small>
            <h1>{{ mode === 'other' ? '읽던 책 고르기' : '새 이야기 시작하기' }}</h1>
          </div>
        </header>

        <div v-if="visibleLibraryBooks.length" class="book-grid">
          <button
            v-for="book in visibleLibraryBooks"
            :key="mode === 'other' ? (book as StorySession).sessionId : book.id"
            class="book-card"
            type="button"
            :disabled="openingBookId === book.id"
            @click="openBook(book)"
          >
            <span class="book-cover">
              <img :src="book.coverImage" :alt="`${mode === 'other' ? sessionTitle(book as StorySession) : book.title} 표지`" />
              <span
                class="status-badge"
                :class="mode === 'new' ? 'status-badge--new' : `status-badge--${(book as StorySession).status.toLowerCase()}`"
              >
                {{
                  mode === 'new'
                    ? '새 이야기'
                    : (book as StorySession).status === 'COMPLETED'
                      ? '완독'
                      : '읽는 중'
                }}
              </span>
            </span>
            <strong>{{ mode === 'other' ? sessionTitle(book as StorySession) : book.title }}</strong>
            <span v-if="mode === 'other'" class="mini-progress" aria-hidden="true">
              <i :style="{ width: `${(book as StorySession).progress}%` }" />
            </span>
            <small>
              {{ mode === 'new' ? '이 책으로 새 이야기 만들기' : progressLabel(book as StorySession) }}
            </small>
          </button>
        </div>

        <div v-else class="catalog-empty">
          <img :src="otherBooksIcon" alt="" aria-hidden="true" />
          <strong>아직 보여 줄 책이 없어요!</strong>
          <button type="button" @click="mode = 'new'">새로운 책 고르기</button>
        </div>
      </template>
    </section>
  </main>
</template>

<style scoped src="@/styles/story/StorySelectionView.css"></style>
