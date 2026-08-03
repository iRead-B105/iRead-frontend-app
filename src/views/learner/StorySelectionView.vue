<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import storyLandBackground from '../../assets/backgrounds/story-section-background.png'
import otherBooksIcon from '../../assets/story/ui/other-books-icon.png'
import newBookIcon from '../../assets/story/ui/new-book-icon.png'
import continueStoryIcon from '../../assets/story/ui/continue-story-icon.png'
import antAndGrasshopperCover from '../../assets/story/covers/ant-and-grasshopper.png'
import byeoljubujeonCover from '../../assets/story/covers/byeoljubujeon.png'
import cinderellaCover from '../../assets/story/covers/cinderella.png'
import oldManAndSeaCover from '../../assets/story/covers/old-man-and-sea.png'
import rabbitAndTurtleCover from '../../assets/story/covers/rabbit-and-turtle.png'
import threeLittlePigsCover from '../../assets/story/covers/three-little-pigs.png'
import { fetchStoryLibrary, startStorySession } from '@/services/learnerDataRepository'
import PageBackButton from '@/components/common/PageBackButton.vue'
import progressStar from '@/assets/training/ui/progress-star.png'

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
const currentPage = ref(1)
const booksPerPage = 3
const storyCoverByTitle: Record<string, string> = {
  별주부전: byeoljubujeonCover,
  신데렐라: cinderellaCover,
  '토끼와 거북이': rabbitAndTurtleCover,
  '개미와 배짱이': antAndGrasshopperCover,
  '아기돼지 삼형제': threeLittlePigsCover,
  '노인과 바다': oldManAndSeaCover,
}

function resolveStoryCover(title: string, fallbackCover: string) {
  for (const [storyTitle, coverImage] of Object.entries(storyCoverByTitle)) {
    if (title.includes(storyTitle)) return coverImage
  }
  return fallbackCover
}

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
    coverImage: resolveStoryCover(story.title, story.coverImageUrl),
    status: story.status,
    progress: story.progress,
    }))
    storyTemplates.value = library.templates.map((template) => ({
    id: template.templateId,
    title: template.title,
    coverImage: resolveStoryCover(template.title, template.coverImageUrl),
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
const pageCount = computed(() => Math.max(1, Math.ceil(visibleLibraryBooks.value.length / booksPerPage)))
const paginatedLibraryBooks = computed(() => {
  const start = (currentPage.value - 1) * booksPerPage
  return visibleLibraryBooks.value.slice(start, start + booksPerPage)
})

watch([mode, pageCount], () => {
  currentPage.value = Math.min(currentPage.value, pageCount.value)
  if (currentPage.value < 1) currentPage.value = 1
})

function openCatalog(nextMode: Exclude<LibraryMode, 'home'>) {
  currentPage.value = 1
  mode.value = nextMode
}

function closeCatalog() {
  currentPage.value = 1
  mode.value = 'home'
}

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
  openCatalog('new')
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
  if (book.status === 'IN_PROGRESS') return `${book.progress}% 읽었어`
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
    <section
      class="library-panel"
      :class="{ 'library-panel--catalog': mode !== 'home' }"
      aria-labelledby="story-library-title"
    >
      <template v-if="mode === 'home'">
        <header class="library-heading">
          <img class="library-heading-star" :src="progressStar" alt="" aria-hidden="true" />
          <h1 id="story-library-title">이야기 나라</h1>
          <img class="library-heading-star" :src="progressStar" alt="" aria-hidden="true" />
        </header>

        <button
          class="continue-card"
          :class="{ 'continue-card--empty': !currentBook }"
          type="button"
          @click="openCurrentBook"
        >
          <template v-if="currentBook">
            <img class="continue-scene" :src="currentBook.coverImage" :alt="`${sessionTitle(currentBook)} 이어 읽기 표지`" />
            <span class="continue-kicker">이어서 읽기</span>
            <span class="continue-progress">{{ currentBook.progress }}%</span>
            <span class="continue-overlay">
              <strong>{{ sessionTitle(currentBook) }}</strong>
              <img :src="continueStoryIcon" alt="" aria-hidden="true" />
            </span>
          </template>
          <template v-else>
            <span class="empty-story-art" aria-hidden="true">
              <img class="empty-story-spark empty-story-spark--one" :src="progressStar" alt="" />
              <img class="empty-story-spark empty-story-spark--two" :src="progressStar" alt="" />
              <img :src="newBookIcon" alt="" />
            </span>
            <span class="empty-story-copy">
              <small>아직 읽고 있는 책이 없어</small>
              <strong>새 이야기를 만나러 가요!</strong>
              <b>마음에 드는 첫 번째 책을 골라봐!</b>
            </span>
            <span class="empty-story-action">
              <span>책 고르기</span>
              <img :src="continueStoryIcon" alt="" aria-hidden="true" />
            </span>
          </template>
        </button>

        <div class="library-actions">
          <button type="button" @click="openCatalog('other')">
            <img class="action-icon" :src="otherBooksIcon" alt="" aria-hidden="true" />
            <strong>읽던 책 고르기</strong>
          </button>
          <button type="button" @click="openCatalog('new')">
            <img class="action-icon" :src="newBookIcon" alt="" aria-hidden="true" />
            <strong>새 이야기 시작하기</strong>
          </button>
        </div>
      </template>

      <template v-else>
        <header class="catalog-heading">
          <PageBackButton label="이야기 나라 처음으로" @back="closeCatalog" />
          <div>
            <small>{{ mode === 'other' ? '나의 책장' : '새 이야기 고르기' }}</small>
            <h1>{{ mode === 'other' ? '읽던 책 고르기' : '새 이야기 시작하기' }}</h1>
          </div>
        </header>

        <div
          v-if="visibleLibraryBooks.length"
          class="book-grid"
          :class="{ 'book-grid--partial': paginatedLibraryBooks.length < booksPerPage }"
        >
          <button
            v-for="book in paginatedLibraryBooks"
            :key="mode === 'other' ? (book as StorySession).sessionId : book.id"
            class="book-card"
            type="button"
            :disabled="openingBookId === book.id"
            @click="openBook(book)"
          >
            <span class="book-cover">
              <img
                :src="book.coverImage"
                :alt="`${mode === 'other' ? sessionTitle(book as StorySession) : book.title} 표지`"
                loading="lazy"
                decoding="async"
              />
              <span
                v-if="mode === 'other' && (book as StorySession).status === 'COMPLETED'"
                class="status-badge status-badge--completed"
              >
                완독
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

        <nav
          v-if="visibleLibraryBooks.length && pageCount > 1"
          class="book-pagination"
          aria-label="이야기 책 페이지"
        >
          <button
            class="pagination-arrow"
            type="button"
            :disabled="currentPage === 1"
            aria-label="이전 책 페이지"
            @click="currentPage -= 1"
          >
            ‹
          </button>
          <button
            v-for="pageNumber in pageCount"
            :key="pageNumber"
            class="pagination-page"
            :class="{ 'pagination-page--active': pageNumber === currentPage }"
            type="button"
            :aria-label="`${pageNumber}번째 책 페이지`"
            :aria-current="pageNumber === currentPage ? 'page' : undefined"
            @click="currentPage = pageNumber"
          >
            {{ pageNumber }}
          </button>
          <button
            class="pagination-arrow"
            type="button"
            :disabled="currentPage === pageCount"
            aria-label="다음 책 페이지"
            @click="currentPage += 1"
          >
            ›
          </button>
        </nav>

        <div v-else class="catalog-empty">
          <img :src="otherBooksIcon" alt="" aria-hidden="true" />
          <strong>아직 보여 줄 책이 없어!</strong>
          <button type="button" @click="openCatalog('new')">새로운 책 고르기</button>
        </div>
      </template>
    </section>
  </main>
</template>

<style scoped src="@/styles/story/StorySelectionView.css"></style>
