// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const repository = vi.hoisted(() => ({
  cachedLibrary: null as Record<string, unknown> | null,
  fetchStoryLibrary: vi.fn(),
}))

vi.mock('@/services/learnerDataRepository', () => ({
  deleteStorySession: vi.fn(),
  fetchStoryLibrary: repository.fetchStoryLibrary,
  getCachedStoryLibrary: () => repository.cachedLibrary,
  startStorySession: vi.fn(),
}))

vi.mock('@/features/learner/story/storyImagePreloader', () => ({
  preloadStoryImages: vi.fn().mockResolvedValue(undefined),
}))

import StorySelectionView from './StorySelectionView.vue'

const library = {
  stories: [{
    storyId: '31',
    templateId: '4',
    sessionNumber: 1,
    createdAt: '2026-08-04T10:00:00',
    lastReadAt: '2026-08-04T10:05:00',
    title: '개미와 배짱이',
    latestBranchSubtitle: '반짝이는 별빛 길로 간다',
    coverImageUrl: '/covers/story.png',
    entryImageUrl: '/scenes/entry.png',
    status: 'IN_PROGRESS',
    progress: 40,
  }],
  templates: [],
}

function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'stories', component: StorySelectionView },
      { path: '/stories/:storyId', name: 'story-reading', component: { template: '<div />' } },
    ],
  })
  return mount(StorySelectionView, { global: { plugins: [router] } })
}

describe('StorySelectionView 사전 로딩', () => {
  beforeEach(() => {
    repository.cachedLibrary = null
    repository.fetchStoryLibrary.mockReset()
  })

  it('책장 데이터가 없을 때 가짜 이어읽기 콘텐츠 대신 로딩 상태를 표시한다', () => {
    repository.fetchStoryLibrary.mockReturnValue(new Promise(() => undefined))

    const wrapper = mountView()

    expect(wrapper.text()).toContain('이야기 책장을 준비하고 있어요.')
    expect(wrapper.text()).not.toContain('새 이야기를 만나러 가요!')
  })

  it('로그인 시 준비된 책장 캐시를 첫 렌더부터 사용한다', () => {
    repository.cachedLibrary = library
    repository.fetchStoryLibrary.mockResolvedValue(library)

    const wrapper = mountView()

    expect(wrapper.text()).toContain('반짝이는 별빛 길로 간다')
    expect(wrapper.text()).toContain('이어서 읽기')
    expect(wrapper.find('.library-loading').exists()).toBe(false)
  })
})
