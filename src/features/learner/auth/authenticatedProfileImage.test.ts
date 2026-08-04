import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { learnerApiClient } from '../learnerApiClient'
import {
  clearAuthenticatedProfileImages,
  resolveAuthenticatedProfileImage,
} from './authenticatedProfileImage'

describe('authenticated profile image', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:student-profile')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(async () => {
    await clearAuthenticatedProfileImages()
    vi.restoreAllMocks()
  })

  it('업로드 프로필을 소유권 확인 API와 명시적 token으로 내려받는다', async () => {
    const download = vi.spyOn(learnerApiClient, 'download').mockResolvedValue({
      blob: new Blob(['profile'], { type: 'image/png' }),
      contentType: 'image/png',
    })

    const resolved = await resolveAuthenticatedProfileImage(
      '2004',
      '/uploads/images/8efbe8c2-5c48-4360-b7c0-c2956bbceda9.png',
      'bootstrap-token',
    )

    expect(download).toHaveBeenCalledWith(
      '/api/auth/app/students/2004/profile-image',
      { headers: { Authorization: 'Bearer bootstrap-token' } },
    )
    expect(resolved).toBe('blob:student-profile')
  })

  it('정적 프로필 이미지는 기존 URL을 유지한다', async () => {
    const download = vi.spyOn(learnerApiClient, 'download')

    const resolved = await resolveAuthenticatedProfileImage(
      '2001',
      '/images/student-profile.png',
      'bootstrap-token',
    )

    expect(resolved).toBe('/images/student-profile.png')
    expect(download).not.toHaveBeenCalled()
  })

  it('업로드 프로필에 token이 없으면 깨진 원본 URL 대신 null을 반환한다', async () => {
    const download = vi.spyOn(learnerApiClient, 'download')

    await expect(resolveAuthenticatedProfileImage(
      '2004',
      '/uploads/images/8efbe8c2-5c48-4360-b7c0-c2956bbceda9.png',
      null,
    )).resolves.toBeNull()
    expect(download).not.toHaveBeenCalled()
  })
})
