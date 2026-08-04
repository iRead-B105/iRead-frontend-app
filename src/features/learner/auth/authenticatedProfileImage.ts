import { learnerApiClient } from '../learnerApiClient'

const LOCAL_PROFILE_IMAGE_PATTERN = /^\/uploads\/images\/[0-9a-f-]{36}\.(?:png|jpg|jpeg)$/
const objectUrls = new Map<string, Promise<string>>()

export async function resolveAuthenticatedProfileImage(
  studentId: string,
  imageUrl: string | null | undefined,
  accessToken: string | null | undefined,
): Promise<string | null> {
  if (!imageUrl) return null
  if (!LOCAL_PROFILE_IMAGE_PATTERN.test(imageUrl)) return imageUrl
  if (!accessToken) return null

  const cacheKey = `${studentId}:${imageUrl}`
  const existing = objectUrls.get(cacheKey)
  if (existing) return existing

  const pending = learnerApiClient.download(
    `/api/auth/app/students/${encodeURIComponent(studentId)}/profile-image`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  ).then(({ blob }) => URL.createObjectURL(blob))
    .catch((error) => {
      objectUrls.delete(cacheKey)
      throw error
    })
  objectUrls.set(cacheKey, pending)
  return pending
}

export async function clearAuthenticatedProfileImages(): Promise<void> {
  const urls = await Promise.allSettled(objectUrls.values())
  urls.forEach((result) => {
    if (result.status === 'fulfilled') URL.revokeObjectURL(result.value)
  })
  objectUrls.clear()
}
