import { beforeEach, describe, expect, it, vi } from 'vitest'

const content = vi.hoisted(() => ({
  getStoryLibrary: vi.fn(),
  getStoryDetail: vi.fn(),
}))

vi.mock('@/features/learner/content', () => ({
  learnerContentRepository: {
    getStoryLibrary: content.getStoryLibrary,
    getStoryDetail: content.getStoryDetail,
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
    content.getStoryDetail.mockReset()
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

  it('로그인 후 이어 읽을 이야기의 장면 경로를 미리 조회한다', async () => {
    content.getStoryLibrary.mockResolvedValue(library(10))
    content.getStoryDetail.mockResolvedValue({
      storyId: '31',
      title: '개미와 배짱이',
      character: '개미',
      branchQuestion: '',
      status: 'IN_PROGRESS',
      currentDay: 1,
      availableDay: 1,
      totalDays: 10,
      pagesPerDay: 10,
      dayComplete: false,
      pages: [
        { lineId: '1', imageUrl: '/scenes/one.png', readAt: '2026-08-04T10:00:00' },
        { lineId: '2', imageUrl: '/scenes/two.png', readAt: null },
      ],
    })
    const repository = await import('./learnerDataRepository')

    await repository.preloadSelectedStudentStoryLibrary()

    expect(content.getStoryDetail).toHaveBeenCalledWith('20', '31')
  })
})
