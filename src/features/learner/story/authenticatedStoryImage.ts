import { learnerApiClient } from '../learnerApiClient'

const GENERATED_IMAGE_PATTERN = /^\/uploads\/images\/([0-9a-f-]{36}\.(?:png|jpg|jpeg))$/
const objectUrls = new Map<string, Promise<string>>()

export async function resolveAuthenticatedStoryImage(
  studentId: string,
  storyId: string,
  imageUrl: string | null | undefined,
): Promise<string | null> {
  if (!imageUrl) return null

  const match = GENERATED_IMAGE_PATTERN.exec(imageUrl)
  const fileName = match?.[1]
  if (!fileName) return imageUrl

  const cacheKey = `${studentId}:${storyId}:${fileName}`
  const existing = objectUrls.get(cacheKey)
  if (existing) return existing

  const pending = learnerApiClient.download(
    `/api/app/story/${encodeURIComponent(studentId)}/${encodeURIComponent(storyId)}`
      + `/images/${encodeURIComponent(fileName)}`,
  ).then(({ blob }) => URL.createObjectURL(blob))
    .catch((error) => {
      objectUrls.delete(cacheKey)
      throw error
    })
  objectUrls.set(cacheKey, pending)
  return pending
}

export async function clearAuthenticatedStoryImages(): Promise<void> {
  const urls = await Promise.allSettled(objectUrls.values())
  urls.forEach((result) => {
    if (result.status === 'fulfilled') URL.revokeObjectURL(result.value)
  })
  objectUrls.clear()
}
