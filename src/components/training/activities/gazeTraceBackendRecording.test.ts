// @vitest-environment jsdom

import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { useTrainingSession } from '@/composables/useTrainingSession'
import type { TrainingQuestion } from '@/types/training'
import GazeTraceActivity from './GazeTraceActivity.vue'

vi.mock('@/features/learner/training/mockDeviceSubmissions', () => ({
  mockVoiceSubmissionsEnabled: false,
}))

vi.mock('@/composables/useAudioPlayer', () => ({
  useAudioPlayer: () => ({ replay: vi.fn(async () => {}), stop: vi.fn() }),
}))

class StubMediaRecorder {
  static latest: StubMediaRecorder | null = null

  state = 'inactive'
  mimeType = 'audio/webm;codecs=opus'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null

  constructor() {
    StubMediaRecorder.latest = this
  }

  start(): void {
    this.state = 'recording'
  }

  stop(): void {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['spoken'], { type: this.mimeType }) })
    this.onstop?.()
  }
}

type EvaluationControls = {
  success: (message?: string) => void
  retry: (message?: string) => void
}

const session = useTrainingSession()
const question: TrainingQuestion = {
  id: 'vowel-trace-backend',
  instruction: '글자를 따라 읽어요',
  answer: 'ㅏ',
  traceGlyph: 'ㅏ',
  targetText: 'ㅏ',
  traceStrokes: [[{ x: 100, y: 100 }, { x: 200, y: 200 }]],
}

describe('글자 따라 읽기 백엔드 녹음 연결', () => {
  beforeEach(() => {
    StubMediaRecorder.latest = null
    Object.defineProperty(window, 'MediaRecorder', {
      value: StubMediaRecorder,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
      configurable: true,
      writable: true,
    })
    URL.createObjectURL = vi.fn(() => 'blob:trace-recording')
    URL.revokeObjectURL = vi.fn()

    session.setAnswerEvaluator(null)
    session.setAnswerCompletedHandler(null)
    session.resetSession()
    session.startLesson({
      id: 'vowel-trace-lesson',
      categoryId: 'phonics',
      title: '글자 따라 읽기',
      description: '',
      activityType: 'gaze-trace',
      estimatedMinutes: 1,
      questions: [question],
    })
  })

  it('발화를 Blob으로 전달하고 백엔드 성공 콜백 전에는 완료하지 않는다', async () => {
    const wrapper = mount(GazeTraceActivity, {
      props: { question },
      global: { stubs: { SoundButton: true } },
    })

    ;(wrapper.vm as unknown as { progress: number }).progress = 2
    await nextTick()
    await Promise.resolve()
    await nextTick()

    // 자동으로 녹음이 시작되지 않고, 마이크 버튼을 눌러야 시작된다.
    expect(StubMediaRecorder.latest).toBeNull()
    expect(wrapper.get('.speech-panel').classes()).toContain('speech-panel--ready')

    await wrapper.get('.mic-state').trigger('click')
    await vi.waitFor(() => expect(StubMediaRecorder.latest?.state).toBe('recording'))

    // 다시 누르면 녹음이 끝나고 평가로 넘어간다.
    await wrapper.get('.mic-state').trigger('click')
    await nextTick()

    const emission = wrapper.emitted('voiceRecorded')?.[0]
    expect(emission?.[0]).toBeInstanceOf(Blob)
    expect(session.progressState.isCurrentCorrect).toBe(null)
    expect(wrapper.get('.speech-panel').classes()).toContain('speech-panel--evaluating')

    ;(emission?.[1] as EvaluationControls).success('백엔드 평가 완료')
    await nextTick()

    expect(session.progressState.isCurrentCorrect).toBe(true)
    expect(session.storedRecordings[question.id]?.blob).toBeInstanceOf(Blob)
    expect(wrapper.find('.next-button').exists()).toBe(true)
    wrapper.unmount()
  })
})
