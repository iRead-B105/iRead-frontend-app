import { afterEach, describe, expect, it, vi } from 'vitest'
import { learnerApiClient } from '../learnerApiClient'
import { ApiLearnerStoryRepository } from './apiLearnerStoryRepository'

describe('API learner story repository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('이야기 분기 음성을 확인용 STT 계약으로 전송한다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      transcript: '오른쪽 길로 갈래요',
      confidence: 0.98,
      accepted: true,
    })
    const repository = new ApiLearnerStoryRepository()
    const audioFile = new File(['voice'], 'branch.webm', { type: 'audio/webm' })

    const result = await repository.transcribeBranchIntent('101', '31', '9', audioFile)

    const call = request.mock.calls[0]!
    expect(call[0]).toBe('/api/app/story/101/31/lines/9/branches/transcribe')
    const body = (call[1] as RequestInit).body as FormData
    expect(body.get('audioFile')).toBe(audioFile)
    expect(result.transcript).toBe('오른쪽 길로 갈래요')
  })

  it('확인된 자유 음성 선택을 backend JSON 계약으로 전송한다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue({ nextLineId: 12 })
    const repository = new ApiLearnerStoryRepository()
    await repository.chooseDirection('101', '31', '9', '오른쪽 길로 갈래요')
    expect(request).toHaveBeenCalledWith(
      '/api/app/story/101/31/lines/9/branches',
      { method: 'POST', body: JSON.stringify({ branchIntent: '오른쪽 길로 갈래요' }) },
    )
  })

  it('AI 선택지 번호를 backend JSON 계약으로 전송한다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      transcript: '용기를 내어 앞으로 가요',
      nextLineId: 12,
      generatedContent: '토끼가 앞으로 걸어갔어요.',
      imageUrl: null,
      progress: 70,
      status: 'IN_PROGRESS',
    })
    const repository = new ApiLearnerStoryRepository()

    await repository.chooseDirection('101', '31', '9', 2)

    expect(request).toHaveBeenCalledWith(
      '/api/app/story/101/31/lines/9/branches',
      { method: 'POST', body: JSON.stringify({ optionNo: 2 }) },
    )
  })

  it('읽은 대사를 backend에 반영한다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue(undefined)
    const repository = new ApiLearnerStoryRepository()

    await repository.markLineRead('101', '31', '9')

    expect(request).toHaveBeenCalledWith('/api/app/story/101/31/lines/9')
  })

  it('TTS 요청에는 backend가 요구하는 숫자 lineId만 보낸다', async () => {
    const request = vi.spyOn(learnerApiClient, 'request').mockResolvedValue({
      audioUrl: '/api/app/story/101/audio/line.mp3',
      durationMs: 1400,
      playbackLimit: 3,
    })
    const repository = new ApiLearnerStoryRepository()

    await repository.synthesizeLine('101', '31', '9')

    expect(request).toHaveBeenCalledWith(
      '/api/app/story/101/31/tts',
      { method: 'POST', body: JSON.stringify({ lineId: 9 }) },
    )
  })

  it('인증이 적용되는 API client로 TTS 음원을 내려받는다', async () => {
    const audio = new Blob(['audio'], { type: 'audio/mpeg' })
    const download = vi.spyOn(learnerApiClient, 'download').mockResolvedValue({
      blob: audio,
      contentType: 'audio/mpeg',
    })
    const repository = new ApiLearnerStoryRepository()

    await expect(
      repository.downloadAudio('/api/app/story/101/audio/line.mp3'),
    ).resolves.toBe(audio)
    expect(download).toHaveBeenCalledWith('/api/app/story/101/audio/line.mp3')
  })
})
