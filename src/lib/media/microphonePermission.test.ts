import { afterEach, describe, expect, it, vi } from 'vitest'
import { queryMicrophonePermission, watchMicrophonePermission } from './microphonePermission'

type ChangeListener = () => void

const createPermissionStatus = (state: PermissionState) => {
  const listeners = new Set<ChangeListener>()
  return {
    status: {
      state,
      addEventListener: (_type: string, listener: ChangeListener) => listeners.add(listener),
      removeEventListener: (_type: string, listener: ChangeListener) => listeners.delete(listener),
    },
    listenerCount: () => listeners.size,
    change(next: PermissionState) {
      this.status.state = next
      listeners.forEach((listener) => listener())
    },
  }
}

const stubPermissions = (query: () => unknown) => {
  vi.stubGlobal('navigator', { permissions: { query } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('queryMicrophonePermission', () => {
  it('브라우저가 알려준 권한 상태를 그대로 돌려준다', async () => {
    stubPermissions(() => Promise.resolve(createPermissionStatus('denied').status))

    await expect(queryMicrophonePermission()).resolves.toBe('denied')
  })

  it('Permissions API 가 없으면 unsupported 로 다룬다', async () => {
    vi.stubGlobal('navigator', {})

    await expect(queryMicrophonePermission()).resolves.toBe('unsupported')
  })

  it("query 가 'microphone' 을 모르고 예외를 던져도 unsupported 로 다룬다", async () => {
    stubPermissions(() => {
      throw new TypeError("'microphone' is not a valid PermissionName")
    })

    await expect(queryMicrophonePermission()).resolves.toBe('unsupported')
  })
})

describe('watchMicrophonePermission', () => {
  it('구독 시점의 권한과 이후 변경을 모두 알린다', async () => {
    const permission = createPermissionStatus('granted')
    stubPermissions(() => Promise.resolve(permission.status))
    const seen: string[] = []

    const stop = watchMicrophonePermission((next) => seen.push(next))
    await vi.waitFor(() => expect(seen).toEqual(['granted']))

    // 사용자가 브라우저 설정에서 마이크를 차단한 상황.
    permission.change('denied')

    expect(seen).toEqual(['granted', 'denied'])
    stop()
  })

  it('구독을 해제하면 더 이상 알리지 않는다', async () => {
    const permission = createPermissionStatus('granted')
    stubPermissions(() => Promise.resolve(permission.status))
    const seen: string[] = []

    const stop = watchMicrophonePermission((next) => seen.push(next))
    await vi.waitFor(() => expect(seen).toEqual(['granted']))

    stop()
    expect(permission.listenerCount()).toBe(0)

    permission.change('denied')
    expect(seen).toEqual(['granted'])
  })

  it('조회할 수 없는 브라우저에서는 unsupported 를 한 번 알린다', async () => {
    vi.stubGlobal('navigator', {})
    const seen: string[] = []

    const stop = watchMicrophonePermission((next) => seen.push(next))
    await vi.waitFor(() => expect(seen).toEqual(['unsupported']))

    stop()
  })
})
