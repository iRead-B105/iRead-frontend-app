const DEFAULT_API_BASE_URL = 'https://api.typecast.ai'
const DEFAULT_VOICE_NAME = 'Siwoo'
const MODEL = 'ssfm-v30'

interface TypecastVoiceModel {
  readonly version: string
}

interface TypecastVoice {
  readonly voice_id: string
  readonly voice_name: string
  readonly models: readonly TypecastVoiceModel[]
}

export interface TypecastTtsClientOptions {
  readonly apiKey: string
  readonly apiBaseUrl?: string
  readonly voiceId?: string
  readonly voiceName?: string
  readonly fetcher?: typeof fetch
}

export interface TypecastTtsClient {
  readonly configured: boolean
  readonly synthesize: (text: string, tempo?: number) => Promise<Blob>
  readonly clearCache: () => void
}

export class TypecastTtsError extends Error {
  override readonly name = 'TypecastTtsError'
}

function normalizeBaseUrl(value: string | undefined): string {
  return (value?.trim() || DEFAULT_API_BASE_URL).replace(/\/+$/, '')
}

function normalizeTempo(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(2, Math.max(0.5, value))
}

async function errorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return response.statusText

  try {
    const body = await response.json() as { readonly detail?: unknown }
    return typeof body.detail === 'string' ? body.detail : response.statusText
  } catch {
    return response.statusText
  }
}

export function createTypecastTtsClient(options: TypecastTtsClientOptions): TypecastTtsClient {
  const apiKey = options.apiKey.trim()
  const apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl)
  const voiceName = options.voiceName?.trim() || DEFAULT_VOICE_NAME
  const configuredVoiceId = options.voiceId?.trim() || ''
  const fetcher = options.fetcher ?? fetch
  const audioCache = new Map<string, Promise<Blob>>()
  let voiceIdRequest: Promise<string> | null = null

  const headers = (): HeadersInit => {
    if (!apiKey) {
      throw new TypecastTtsError('VITE_TYPECAST_API_KEY가 설정되지 않았습니다.')
    }
    return { 'X-API-KEY': apiKey }
  }

  const resolveVoiceId = (): Promise<string> => {
    if (configuredVoiceId) return Promise.resolve(configuredVoiceId)
    if (voiceIdRequest) return voiceIdRequest

    voiceIdRequest = (async () => {
      const response = await fetcher(`${apiBaseUrl}/v2/voices?model=${MODEL}`, {
        headers: headers(),
      })
      if (!response.ok) {
        throw new TypecastTtsError(
          `Typecast 보이스 목록 요청 실패 (${response.status}): ${await errorMessage(response)}`,
        )
      }

      const voices = await response.json() as readonly TypecastVoice[]
      const normalizedName = voiceName.toLocaleLowerCase('en-US')
      const voice = voices.find((candidate) =>
        candidate.voice_name.toLocaleLowerCase('en-US') === normalizedName
        && candidate.models.some((model) => model.version === MODEL),
      )
      if (!voice) {
        throw new TypecastTtsError(`Typecast ${voiceName} 보이스를 찾을 수 없습니다.`)
      }
      return voice.voice_id
    })().catch((error: unknown) => {
      voiceIdRequest = null
      throw error
    })

    return voiceIdRequest
  }

  const synthesizeUncached = async (text: string, tempo: number): Promise<Blob> => {
    const voiceId = await resolveVoiceId()
    const response = await fetcher(`${apiBaseUrl}/v1/text-to-speech`, {
      method: 'POST',
      headers: {
        ...headers(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voice_id: voiceId,
        text,
        model: MODEL,
        language: 'kor',
        output: {
          volume: 100,
          audio_pitch: 0,
          audio_tempo: tempo,
          audio_format: 'mp3',
        },
      }),
    })
    if (!response.ok) {
      throw new TypecastTtsError(
        `Typecast 음성 생성 실패 (${response.status}): ${await errorMessage(response)}`,
      )
    }

    const audio = await response.arrayBuffer()
    if (audio.byteLength === 0) {
      throw new TypecastTtsError('Typecast가 빈 음성을 반환했습니다.')
    }
    return new Blob([audio], {
      type: response.headers.get('content-type') || 'audio/mpeg',
    })
  }

  return {
    configured: apiKey.length > 0,
    synthesize(text, tempo = 1) {
      const normalizedText = text.trim()
      if (!normalizedText) return Promise.reject(new TypecastTtsError('재생할 문장이 없습니다.'))

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

export const typecastTtsClient = createTypecastTtsClient({
  apiKey: import.meta.env.VITE_TYPECAST_API_KEY ?? '',
  apiBaseUrl: import.meta.env.VITE_TYPECAST_API_BASE_URL,
  voiceId: import.meta.env.VITE_TYPECAST_VOICE_ID,
  voiceName: 'Siwoo',
})
