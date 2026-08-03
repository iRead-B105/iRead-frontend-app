import { describe, expect, it, vi } from 'vitest'
import type { DownloadResult } from '@/lib/api'
import { createTypecastTtsClient, TypecastTtsError } from './typecastTtsClient'

function audioResult(bytes: number[]): DownloadResult {
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' }),
    contentType: 'audio/mpeg',
  }
}

describe('TypecastTtsClient', () => {
  it('백엔드 TTS 프록시에서 베리 MP3를 내려받는다', async () => {
    const download = vi.fn().mockResolvedValue(audioResult([1, 2, 3]))
    const client = createTypecastTtsClient({ download })

    const audio = await client.synthesize(' 안녕하세요 ', 0.72)

    expect(audio.type).toBe('audio/mpeg')
    expect(download).toHaveBeenCalledWith('/api/app/tts', {
      method: 'POST',
      headers: { Accept: 'audio/mpeg, application/json' },
      body: JSON.stringify({ text: '안녕하세요', tempo: 0.72 }),
    })
  })

  it('같은 문장과 속도의 음성을 캐시한다', async () => {
    const download = vi.fn().mockResolvedValue(audioResult([1]))
    const client = createTypecastTtsClient({ download })

    const first = await client.synthesize('같은 문장', 1)
    const second = await client.synthesize('같은 문장', 1)

    expect(first).toBe(second)
    expect(download).toHaveBeenCalledTimes(1)
  })

  it('빈 문장은 백엔드 호출 전에 거절한다', async () => {
    const download = vi.fn()
    const client = createTypecastTtsClient({ download })

    await expect(client.synthesize('  ')).rejects.toEqual(
      expect.objectContaining<TypecastTtsError>({
        name: 'TypecastTtsError',
        message: '재생할 문장이 없습니다.',
      }),
    )
    expect(download).not.toHaveBeenCalled()
  })
})
