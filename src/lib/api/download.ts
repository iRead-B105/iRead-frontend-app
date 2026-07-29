export interface DownloadResult {
  readonly blob: Blob
  readonly fileName?: string
  readonly contentType: string
}

function sanitizeFileName(value: string): string | undefined {
  const withoutControlCharacters = [...value]
    .filter((character) => {
      const characterCode = character.charCodeAt(0)
      return characterCode > 31 && characterCode !== 127
    })
    .join('')
    .trim()
  const pathSegments = withoutControlCharacters.split(/[\\/]/)
  const baseName = pathSegments[pathSegments.length - 1]?.trim()

  return baseName || undefined
}

function decodeExtendedFileName(value: string): string | undefined {
  const normalized = value.trim().replace(/^"|"$/g, '')

  try {
    return sanitizeFileName(decodeURIComponent(normalized))
  } catch {
    return sanitizeFileName(normalized)
  }
}

export function getDownloadFileName(contentDisposition: string | null): string | undefined {
  if (!contentDisposition) {
    return undefined
  }

  const extendedMatch = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
  if (extendedMatch?.[1]) {
    return decodeExtendedFileName(extendedMatch[1])
  }

  const basicMatch = contentDisposition.match(/filename\s*=\s*(?:"([^"]*)"|([^;]*))/i)
  const basicFileName = basicMatch?.[1] ?? basicMatch?.[2]

  return basicFileName ? sanitizeFileName(basicFileName) : undefined
}

export async function createDownloadResult(response: Response): Promise<DownloadResult> {
  const blob = await response.blob()

  return {
    blob,
    fileName: getDownloadFileName(response.headers.get('content-disposition')),
    contentType: response.headers.get('content-type') || blob.type || 'application/octet-stream',
  }
}

export function saveDownload(result: DownloadResult, fallbackFileName = 'download'): void {
  const objectUrl = URL.createObjectURL(result.blob)
  const anchor = document.createElement('a')

  anchor.href = objectUrl
  anchor.download = result.fileName ?? fallbackFileName
  anchor.hidden = true
  document.body.append(anchor)

  try {
    anchor.click()
  } finally {
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  }
}
