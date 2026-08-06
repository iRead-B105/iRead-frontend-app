// @vitest-environment jsdom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let useDeveloperMode: typeof import('./useDeveloperMode').useDeveloperMode

beforeAll(async () => {
  const values = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size
      },
    } satisfies Storage,
  })
  ;({ useDeveloperMode } = await import('./useDeveloperMode'))
})

describe('useDeveloperMode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
    useDeveloperMode().setEnabled(false)
  })

  it('로고를 제한 시간 안에 5번 누르면 DEV 모드를 켠다', () => {
    const developerMode = useDeveloperMode()

    for (let index = 0; index < 4; index += 1) {
      expect(developerMode.registerLogoClick()).toBe(false)
    }
    expect(developerMode.registerLogoClick()).toBe(true)
    expect(developerMode.enabled.value).toBe(true)
    expect(window.localStorage.getItem('iread:developer-mode')).toBe('on')
  })

  it('클릭 간격이 길면 연속 횟수를 초기화한다', () => {
    const developerMode = useDeveloperMode()

    for (let index = 0; index < 4; index += 1) developerMode.registerLogoClick()
    vi.advanceTimersByTime(1_501)
    expect(developerMode.registerLogoClick()).toBe(false)
    expect(developerMode.enabled.value).toBe(false)
  })

  it('DEV 모드를 끄면 음성 디버그 점수도 지운다', () => {
    const developerMode = useDeveloperMode()
    developerMode.setEnabled(true)
    developerMode.recordVoiceScore({
      score: 82,
      threshold: 70,
      passed: true,
      canRetry: false,
      expectedText: '가',
      questionNumber: 1,
    })

    developerMode.setEnabled(false)
    expect(developerMode.latestVoiceScore.value).toBeNull()
  })
})
