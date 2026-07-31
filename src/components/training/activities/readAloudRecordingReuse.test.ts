// @vitest-environment jsdom

import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { useTrainingSession } from '@/composables/useTrainingSession'
import type { TrainingQuestion } from '@/types/training'
import ReadAloudActivity from './ReadAloudActivity.vue'

// 테스트 환경 기본값은 목 제출이라, 실제 녹음 경로만 켜고 확인한다.
vi.mock('@/features/learner/training/mockDeviceSubmissions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/learner/training/mockDeviceSubmissions')>()),
  mockVoiceSubmissionsEnabled: false,
}))

const session = useTrainingSession()

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
    this.ondataavailable?.({
      data: new Blob(['spoken'], { type: 'audio/webm;codecs=opus' }),
    })
    this.onstop?.()
  }
}

const question: TrainingQuestion = {
  id: 'read-aloud',
  instruction: '소리 내어 읽어요',
  answer: '아기는 사과를 먹는다.',
  targetText: '아기는 사과를 먹는다.',
  phraseChunks: ['아기는', '사과를', '먹는다.'],
}

const enableMicrophone = (): void => {
  StubMediaRecorder.latest = null
  Object.defineProperty(window, 'MediaRecorder', {
    value: StubMediaRecorder, configurable: true, writable: true,
  })
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
    configurable: true,
    writable: true,
  })
  URL.createObjectURL = vi.fn(() => 'blob:stub')
  URL.revokeObjectURL = vi.fn()
}

describe('따라 읽기 녹음 재사용', () => {
  beforeEach(() => {
    session.setAnswerEvaluator(null)
    session.setAnswerCompletedHandler(null)
    session.resetSession()
    session.startLesson({
      id: 'read-aloud-lesson',
      categoryId: 'fluency',
      title: '문장 따라 읽기',
      description: '',
      activityType: 'read-aloud',
      estimatedMinutes: 3,
      questions: [question],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('마이크로 읽은 음성을 세션에 남겨 상위가 그대로 제출하게 한다', async () => {
    enableMicrophone()
    const wrapper = mount(ReadAloudActivity, { props: { question } })

    await wrapper.get('.mic-button').trigger('click')
    await nextTick()
    StubMediaRecorder.latest?.stop()
    await nextTick()

    const recording = session.storedRecordings[question.id]
    // blob이 없으면 상위가 게이트를 열어 같은 문장을 다시 읽힌다.
    expect(recording?.blob).toBeInstanceOf(Blob)
    expect(recording?.isMock).toBe(false)
    wrapper.unmount()
  })
})
