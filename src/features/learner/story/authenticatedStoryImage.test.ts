import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { learnerApiClient } from '../learnerApiClient'
import {
  clearAuthenticatedStoryImages,
  releaseAuthenticatedStoryImageObjectUrls,
  resolveAuthenticatedStoryImage,
} from './authenticatedStoryImage'

function cacheStorageMock(): CacheStorage {
  const stores = new Map<string, Map<string, Response>>()
  const requestKey = (request: RequestInfo | URL) => (
    typeof request === 'string' ? request : request instanceof URL ? request.toString() : request.url
  )

  return {
    async open(name: string) {
      const entries = stores.get(name) ?? new Map<string, Response>()
      stores.set(name, entries)
      return {
        async match(request: RequestInfo | URL) {
          return entries.get(requestKey(request))?.clone()
        },
        async put(request: RequestInfo | URL, response: Response) {
          entries.set(requestKey(request), response.clone())
        },
        async keys() {
          return [...entries.keys()].map((url) => new Request(url))
        },
        async delete(request: RequestInfo | URL) {
          return entries.delete(requestKey(request))
        },
      } as unknown as Cache
    },
    async keys() {
      return [...stores.keys()]
    },
    async delete(name: string) {
      return stores.delete(name)
    },
  } as CacheStorage
}

describe('authenticated story image', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:story-scene')
    URL.revokeObjectURL = vi.fn()
    vi.stubGlobal('caches', cacheStorageMock())
  })

  afterEach(async () => {
    await clearAuthenticatedStoryImages()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('생성 이미지를 소유권 확인 API로 내려받아 Blob URL로 만든다', async () => {
    const download = vi.spyOn(learnerApiClient, 'download').mockResolvedValue({
      blob: new Blob(['scene'], { type: 'image/png' }),
      contentType: 'image/png',
    })

    const resolved = await resolveAuthenticatedStoryImage(
      '2001',
      '180142',
      '/uploads/images/123e4567-e89b-12d3-a456-426614174000.png',
    )

    expect(download).toHaveBeenCalledWith(
      '/api/app/story/2001/180142/images/123e4567-e89b-12d3-a456-426614174000.png',
    )
    expect(resolved).toBe('blob:story-scene')
  })

  it('동일한 이야기 이미지는 한 번만 내려받는다', async () => {
    const download = vi.spyOn(learnerApiClient, 'download').mockResolvedValue({
      blob: new Blob(['scene'], { type: 'image/png' }),
      contentType: 'image/png',
    })
    const imageUrl = '/uploads/images/123e4567-e89b-12d3-a456-426614174001.png'

    const first = await resolveAuthenticatedStoryImage('2001', '180142', imageUrl)
    const second = await resolveAuthenticatedStoryImage('2001', '180142', imageUrl)

    expect(first).toBe(second)
    expect(download).toHaveBeenCalledTimes(1)
  })

  it('새로고침처럼 메모리 URL이 사라져도 영속 캐시에서 복원한다', async () => {
    const download = vi.spyOn(learnerApiClient, 'download').mockResolvedValue({
      blob: new Blob(['persisted-scene'], { type: 'image/png' }),
      contentType: 'image/png',
    })
    const imageUrl = '/uploads/images/123e4567-e89b-12d3-a456-426614174002.png'

    await resolveAuthenticatedStoryImage('2001', '180142', imageUrl)
    await releaseAuthenticatedStoryImageObjectUrls('2001')
    const restored = await resolveAuthenticatedStoryImage('2001', '180142', imageUrl)

    expect(restored).toBe('blob:story-scene')
    expect(download).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2)
  })

  it('학생 캐시를 지우면 다음 조회에서 이미지를 다시 인증 다운로드한다', async () => {
    const download = vi.spyOn(learnerApiClient, 'download').mockResolvedValue({
      blob: new Blob(['private-scene'], { type: 'image/png' }),
      contentType: 'image/png',
    })
    const imageUrl = '/uploads/images/123e4567-e89b-12d3-a456-426614174003.png'

    await resolveAuthenticatedStoryImage('2001', '180142', imageUrl)
    await clearAuthenticatedStoryImages('2001')
    await resolveAuthenticatedStoryImage('2001', '180142', imageUrl)

    expect(download).toHaveBeenCalledTimes(2)
  })

  it('학생별 영속 캐시는 최근 이미지 60장까지만 유지한다', async () => {
    vi.spyOn(learnerApiClient, 'download').mockResolvedValue({
      blob: new Blob(['bounded-scene'], { type: 'image/png' }),
      contentType: 'image/png',
    })

    for (let index = 0; index < 61; index += 1) {
      const suffix = index.toString(16).padStart(12, '0')
      await resolveAuthenticatedStoryImage(
        '2001',
        '180142',
        `/uploads/images/123e4567-e89b-12d3-a456-${suffix}.png`,
      )
    }

    const cache = await caches.open('iread-story-images-v1:2001')
    expect(await cache.keys()).toHaveLength(60)
  })

  it('템플릿과 정적 이미지는 기존 URL을 유지한다', async () => {
    const download = vi.spyOn(learnerApiClient, 'download')

    const resolved = await resolveAuthenticatedStoryImage(
      '2001',
      '180142',
      '/assets/story-cover.png',
    )

    expect(resolved).toBe('/assets/story-cover.png')
    expect(download).not.toHaveBeenCalled()
  })
})
