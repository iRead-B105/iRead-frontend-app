import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { learnerApiClient } from '../learnerApiClient'
import {
  clearAuthenticatedStoryImages,
  resolveAuthenticatedStoryImage,
} from './authenticatedStoryImage'

describe('authenticated story image', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:story-scene')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(async () => {
    await clearAuthenticatedStoryImages()
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
