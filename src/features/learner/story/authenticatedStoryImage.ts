import { learnerApiClient } from '../learnerApiClient'

const GENERATED_IMAGE_PATTERN = /^\/uploads\/images\/([0-9a-f-]{36}\.(?:png|jpg|jpeg))$/
const CACHE_NAME_PREFIX = 'iread-story-images-v1:'
const MAX_CACHED_IMAGES_PER_STUDENT = 60
const objectUrls = new Map<string, Promise<string>>()

function cacheStorage(): CacheStorage | null {
  return typeof globalThis.caches === 'undefined' ? null : globalThis.caches
}

function studentCacheName(studentId: string): string {
  return `${CACHE_NAME_PREFIX}${encodeURIComponent(studentId)}`
}

function imageEndpoint(studentId: string, storyId: string, fileName: string): string {
  return `/api/app/story/${encodeURIComponent(studentId)}/${encodeURIComponent(storyId)}`
    + `/images/${encodeURIComponent(fileName)}`
}

function absoluteCacheKey(endpoint: string): string {
  // Electron의 app:// origin도 Cache API가 허용하는 HTTPS Request 키로 정규화한다.
  // 실제 네트워크 요청에는 이 합성 origin을 사용하지 않는다.
  return new URL(endpoint, 'https://cache.iread.local').toString()
}

async function readPersistentImage(
  studentId: string,
  endpoint: string,
): Promise<Blob | null> {
  const storage = cacheStorage()
  if (!storage) return null

  try {
    const cache = await storage.open(studentCacheName(studentId))
    const response = await cache.match(absoluteCacheKey(endpoint))
    return response?.ok ? await response.blob() : null
  } catch {
    // Cache Storage가 비활성화된 환경에서는 기존 인증 다운로드로 폴백한다.
    return null
  }
}

async function persistImage(
  studentId: string,
  endpoint: string,
  blob: Blob,
  contentType: string,
): Promise<void> {
  const storage = cacheStorage()
  if (!storage) return

  try {
    const cache = await storage.open(studentCacheName(studentId))
    await cache.put(absoluteCacheKey(endpoint), new Response(blob, {
      headers: { 'Content-Type': contentType || blob.type || 'application/octet-stream' },
    }))

    // UUID 이미지 URL은 불변이므로 학생별 최근 60장만 보존하는 FIFO 상한이면
    // 재검증 없이 빠르게 재사용하면서 저장 공간 증가를 제한할 수 있다.
    const keys = await cache.keys()
    const overflow = keys.length - MAX_CACHED_IMAGES_PER_STUDENT
    if (overflow > 0) {
      await Promise.all(keys.slice(0, overflow).map((request) => cache.delete(request)))
    }
  } catch {
    // 영속 캐시 실패는 이미지 표시 자체를 실패시키지 않는다.
  }
}

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

  const endpoint = imageEndpoint(studentId, storyId, fileName)
  const pending = readPersistentImage(studentId, endpoint)
    .then(async (cachedBlob) => {
      if (cachedBlob) return URL.createObjectURL(cachedBlob)

      const { blob, contentType } = await learnerApiClient.download(endpoint)
      await persistImage(studentId, endpoint, blob, contentType)
      return URL.createObjectURL(blob)
    })
    .catch((error) => {
      objectUrls.delete(cacheKey)
      throw error
    })
  objectUrls.set(cacheKey, pending)
  return pending
}

export async function releaseAuthenticatedStoryImageObjectUrls(
  studentId?: string,
): Promise<void> {
  const entries = [...objectUrls.entries()].filter(([key]) => (
    studentId === undefined || key.startsWith(`${studentId}:`)
  ))
  await Promise.all(entries.map(async ([key, pending]) => {
    const result = await Promise.resolve(pending).then(
      (url) => ({ status: 'fulfilled' as const, url }),
      () => ({ status: 'rejected' as const }),
    )
    if (result.status === 'fulfilled') URL.revokeObjectURL(result.url)
    objectUrls.delete(key)
  }))
}

export async function clearAuthenticatedStoryImages(studentId?: string): Promise<void> {
  await releaseAuthenticatedStoryImageObjectUrls(studentId)

  const storage = cacheStorage()
  if (!storage) return
  try {
    if (studentId !== undefined) {
      await storage.delete(studentCacheName(studentId))
      return
    }
    const cacheNames = await storage.keys()
    await Promise.all(cacheNames
      .filter((name) => name.startsWith(CACHE_NAME_PREFIX))
      .map((name) => storage.delete(name)))
  } catch {
    // 로그아웃은 브라우저 저장소 API 실패 여부와 무관하게 계속 진행한다.
  }
}
