import { learnerApiClient } from '@/features/learner/learnerApiClient'

export interface TypecastTtsClientOptions {
  readonly download?: typeof learnerApiClient.download
}

export interface TypecastTtsClient {
  readonly configured: boolean
  readonly synthesize: (text: string, tempo?: number) => Promise<Blob>
  readonly clearCache: () => void
}

export class TypecastTtsError extends Error {
  override readonly name = 'TypecastTtsError'
}

function normalizeTempo(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(2, Math.max(0.5, value))
}

export function createTypecastTtsClient(options: TypecastTtsClientOptions = {}): TypecastTtsClient {
  const download = options.download ?? learnerApiClient.download.bind(learnerApiClient)
  const audioCache = new Map<string, Promise<Blob>>()

  const synthesizeUncached = async (text: string, tempo: number): Promise<Blob> => {
    const result = await download('/api/app/tts', {
      method: 'POST',
      headers: { Accept: 'audio/mpeg, application/json' },
      body: JSON.stringify({ text, tempo }),
    })
    if (result.blob.size === 0) {
      throw new TypecastTtsError('백엔드가 빈 음성을 반환했습니다.')
    }
    return result.blob
  }

  return {
    configured: true,
    synthesize(text, tempo = 1) {
      const normalizedText = text.trim()
      if (!normalizedText) {
        return Promise.reject(new TypecastTtsError('재생할 문장이 없습니다.'))
      }

      const normalizedTempo = normalizeTempo(tempo)
      const cacheKey = `${normalizedTempo}\u0000${normalizedText}`
      const cached = audioCache.get(cacheKey)
      if (cached) return cached

      const request = synthesizeUncached(normalizedText, normalizedTempo).catch((error: unknown) => {
        audioCache.delete(cacheKey)
        throw error
      })
      audioCache.set(cacheKey, request)
      return request
    },
    clearCache() {
      audioCache.clear()
    },
  }
}

export const typecastTtsClient = createTypecastTtsClient()
