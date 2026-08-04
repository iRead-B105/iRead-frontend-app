import { beforeEach, describe, expect, it, vi } from 'vitest'

const content = vi.hoisted(() => ({
  getStoryLibrary: vi.fn(),
}))

vi.mock('@/features/learner/content', () => ({
  learnerContentRepository: {
    getStoryLibrary: content.getStoryLibrary,
  },
}))

vi.mock('@/stores/learnerSession', () => ({
  useLearnerSessionStore: () => ({
    student: {
      studentId: '20',
      name: '새봄',
      age: 8,
      profileColor: '#FFD166',
      profileImageUrl: null,
    },
  }),
}))

const library = (progress: number) => ({
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
    status: 'IN_PROGRESS' as const,
    progress,
  }],
  templates: [],
})

describe('learnerDataRepository 이야기 책장 캐시', () => {
  beforeEach(() => {
    vi.resetModules()
    content.getStoryLibrary.mockReset()
  })

  it('같은 아동의 준비된 책장을 중복 조회하지 않는다', async () => {
    content.getStoryLibrary.mockResolvedValue(library(10))
    const repository = await import('./learnerDataRepository')

    await repository.fetchStoryLibrary()
    await repository.fetchStoryLibrary()

    expect(content.getStoryLibrary).toHaveBeenCalledTimes(1)
  })

  it('독서 진행 후 오래된 캐시를 최신 책장으로 갱신한다', async () => {
    content.getStoryLibrary
      .mockResolvedValueOnce(library(10))
      .mockResolvedValueOnce(library(20))
    const repository = await import('./learnerDataRepository')

    await repository.fetchStoryLibrary()
    repository.markStoryLibraryCacheStale()
    const refreshed = await repository.fetchStoryLibrary()

    expect(content.getStoryLibrary).toHaveBeenCalledTimes(2)
    expect(refreshed.stories[0]?.progress).toBe(20)
  })
})
