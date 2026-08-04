const pendingImages = new Map<string, Promise<void>>()

export function preloadStoryImage(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl || typeof Image === 'undefined') return Promise.resolve()

  const existing = pendingImages.get(imageUrl)
  if (existing) return existing

  const pending = new Promise<void>((resolve) => {
    const image = new Image()
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const decode = () => {
      if (typeof image.decode !== 'function') {
        finish()
        return
      }
      void image.decode().catch(() => undefined).then(finish)
    }
    image.decoding = 'async'
    image.onload = decode
    image.onerror = finish
    image.src = imageUrl
    if (image.complete) {
      if (image.naturalWidth > 0) decode()
      else finish()
    }
  })
  pendingImages.set(imageUrl, pending)
  return pending
}

export async function preloadStoryImages(
  imageUrls: readonly (string | null | undefined)[],
): Promise<void> {
  await Promise.all(imageUrls.map((imageUrl) => preloadStoryImage(imageUrl)))
}
