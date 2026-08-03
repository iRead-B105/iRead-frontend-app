import { describe, expect, it, vi } from 'vitest'
import { createTypecastTtsClient, TypecastTtsError } from './typecastTtsClient'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('TypecastTtsClient', () => {
  it('Siwoo 보이스를 조회하고 한국어 MP3를 생성한다', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([
        {
          voice_id: 'tc_siwoo',
          voice_name: 'Siwoo',
          models: [{ version: 'ssfm-v30' }],
        },
      ]))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'audio/mpeg' },
      }))
    const client = createTypecastTtsClient({ apiKey: 'test-key', fetcher })

    expect(client.configured).toBe(true)
    const audio = await client.synthesize(' 안녕하세요 ', 0.72)

    expect(audio.type).toBe('audio/mpeg')
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'https://api.typecast.ai/v2/voices?model=ssfm-v30',
      { headers: { 'X-API-KEY': 'test-key' } },
    )
    const synthesisCall = fetcher.mock.calls[1]!
    expect(synthesisCall[0]).toBe('https://api.typecast.ai/v1/text-to-speech')
    const request = synthesisCall[1] as RequestInit
    expect(JSON.parse(String(request.body))).toEqual({
      voice_id: 'tc_siwoo',
      text: '안녕하세요',
      model: 'ssfm-v30',
      language: 'kor',
      output: {
        volume: 100,
        audio_pitch: 0,
        audio_tempo: 0.72,
        audio_format: 'mp3',
      },
    })
  })

  it('같은 문장과 속도의 음성을 캐시한다', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(new Uint8Array([1]), {
        headers: { 'Content-Type': 'audio/mpeg' },
      }))
    const client = createTypecastTtsClient({
      apiKey: 'test-key',
      voiceId: 'tc_siwoo',
      fetcher,
    })

    const first = await client.synthesize('같은 문장', 1)
    const second = await client.synthesize('같은 문장', 1)

    expect(first).toBe(second)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('API 키가 없으면 네트워크 요청 전에 명확한 오류를 반환한다', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const client = createTypecastTtsClient({ apiKey: '', fetcher })

    expect(client.configured).toBe(false)
    await expect(client.synthesize('안녕하세요')).rejects.toEqual(
      expect.objectContaining<TypecastTtsError>({
        name: 'TypecastTtsError',
        message: 'VITE_TYPECAST_API_KEY가 설정되지 않았습니다.',
      }),
    )
    expect(fetcher).not.toHaveBeenCalled()
  })
})
