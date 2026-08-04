// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const repository = vi.hoisted(() => ({
  cachedLibrary: null as Record<string, unknown> | null,
  deleteStorySession: vi.fn(),
  fetchStoryLibrary: vi.fn(),
  startStorySession: vi.fn(),
}))

vi.mock('@/services/learnerDataRepository', () => ({
  deleteStorySession: repository.deleteStorySession,
  fetchStoryLibrary: repository.fetchStoryLibrary,
  getCachedStoryLibrary: () => repository.cachedLibrary,
  startStorySession: repository.startStorySession,
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
    repository.deleteStorySession.mockReset()
    repository.fetchStoryLibrary.mockReset()
    repository.startStorySession.mockReset()
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
    expect(wrapper.find('.continue-kicker').text()).toBe('이어서 읽기 40%')
    expect(wrapper.find('.continue-overlay strong').text()).toBe(
      '개미와 배짱이 - 반짝이는 별빛 길로 간다',
    )
    expect(wrapper.find('.continue-progress').exists()).toBe(false)
    expect(wrapper.find('.library-loading').exists()).toBe(false)
  })

  it('새 책을 선택하면 생성 상태를 표시하고 생성된 이야기 화면으로 이동한다', async () => {
    let finishCreation!: (storyId: string) => void
    const creatingStory = new Promise<string>((resolve) => {
      finishCreation = resolve
    })
    const libraryWithTemplate = {
      stories: [],
      templates: [{
        templateId: '4',
        title: '개미와 배짱이',
        coverImageUrl: '/covers/story.png',
      }],
    }
    repository.cachedLibrary = libraryWithTemplate
    repository.fetchStoryLibrary.mockResolvedValue(libraryWithTemplate)
    repository.startStorySession.mockReturnValue(creatingStory)

    const wrapper = mountView()
    const newStoryButton = wrapper.findAll('.library-actions button')
      .find((button) => button.text().includes('새 이야기 시작하기'))
    await newStoryButton?.trigger('click')
    await wrapper.find('.book-card').trigger('click')

    expect(wrapper.find('.story-creation-overlay').text()).toContain('새 이야기를 만들고 있어요!')
    expect(repository.startStorySession).toHaveBeenCalledWith('4')

    finishCreation('180141')
    await vi.waitFor(() => {
      expect(wrapper.vm.$route.fullPath).toBe('/stories/180141?new=1')
    })
  })

  it('책장 필터는 제목과 같은 헤더 행에 배치한다', async () => {
    repository.cachedLibrary = library
    repository.fetchStoryLibrary.mockResolvedValue(library)

    const wrapper = mountView()
    const otherBooksButton = wrapper.findAll('.library-actions button')
      .find((button) => button.text().includes('읽던 책 고르기'))
    await otherBooksButton?.trigger('click')

    expect(wrapper.find('.catalog-heading > .shelf-tabs').exists()).toBe(true)
    expect(wrapper.find('.catalog-content > .shelf-tabs').exists()).toBe(false)
  })
})
