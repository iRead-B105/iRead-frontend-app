import { learnerApiClient } from '../learnerApiClient'

// 백엔드 FileStorage에 저장된 학습 문항 삽화 URL 패턴.
const GENERATED_IMAGE_PATTERN = /^\/uploads\/images\/([0-9a-f-]{36}\.(?:png|jpg|jpeg))$/
const objectUrls = new Map<string, Promise<string>>()

/**
 * 문항 content.imageUrl(백엔드 저장 경로)을 아동 세션 인증으로 내려받아
 * 화면에서 바로 쓸 수 있는 blob URL로 바꾼다. 패턴이 아니면 그대로 반환.
 */
export async function resolveAuthenticatedQuestionImage(
  studentId: string,
  imageUrl: string | null | undefined,
): Promise<string | null> {
  if (!imageUrl) return null

  const match = GENERATED_IMAGE_PATTERN.exec(imageUrl)
  const fileName = match?.[1]
  if (!fileName) return imageUrl

  const cacheKey = `${studentId}:${fileName}`
  const existing = objectUrls.get(cacheKey)
  if (existing) return existing

  const pending = learnerApiClient.download(
    `/api/app/learning/${encodeURIComponent(studentId)}/images/${encodeURIComponent(fileName)}`,
  ).then(({ blob }) => URL.createObjectURL(blob))
    .catch((error) => {
      objectUrls.delete(cacheKey)
      throw error
    })
  objectUrls.set(cacheKey, pending)
  return pending
}
