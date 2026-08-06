// @vitest-environment jsdom

// 회귀 방지: 마이크를 비허용했다가 브라우저에서 다시 허용해도 문제풀이 화면의
// "마이크 사용 권한이 꺼져 있어요" 안내가 사라지지 않았다. 다음 녹음 시도가
// 있을 때까지 권한 변화를 알 방법이 없었기 때문이다.

import { effectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useVoiceRecorder } from './useVoiceRecorder'
import { useDeviceStatus } from './useDeviceStatus'

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

const stubNavigator = (permissionStatus: object, getUserMedia?: () => Promise<unknown>) => {
  vi.stubGlobal('navigator', {
    permissions: { query: () => Promise.resolve(permissionStatus) },
    mediaDevices: getUserMedia ? { getUserMedia } : undefined,
  })
}

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useVoiceRecorder 권한 변화 반영', () => {
  it('권한이 차단되면 거부 안내와 공용 장치 상태를 함께 내린다', async () => {
    const permission = createPermissionStatus('granted')
    stubNavigator(permission.status)
    const deviceStatus = useDeviceStatus()
    deviceStatus.setMicrophoneState({ available: true, active: false })

    const scope = effectScope()
    const recorder = scope.run(() => useVoiceRecorder())!
    await flush()
    expect(recorder.state.status).toBe('idle')

    permission.change('denied')
    await flush()

    expect(recorder.state.status).toBe('denied')
    expect(recorder.state.errorMessage).toContain('마이크 사용 권한이 꺼져 있어요')
    expect(deviceStatus.microphoneAvailable.value).toBe(false)

    scope.stop()
  })

  it('다시 허용하면 남아 있던 거부 안내를 걷어낸다', async () => {
    const permission = createPermissionStatus('denied')
    stubNavigator(permission.status)

    const scope = effectScope()
    const recorder = scope.run(() => useVoiceRecorder())!
    await flush()
    expect(recorder.state.status).toBe('denied')
    expect(recorder.state.errorMessage).not.toBeNull()

    permission.change('granted')
    await flush()

    expect(recorder.state.status).toBe('idle')
    expect(recorder.state.errorMessage).toBeNull()
    expect(recorder.permission.value).toBe('granted')

    scope.stop()
  })

  it('녹음 결과가 남아 있으면 권한 변화가 그 결과를 지우지 않는다', async () => {
    const permission = createPermissionStatus('granted')
    stubNavigator(permission.status)

    const scope = effectScope()
    const recorder = scope.run(() => useVoiceRecorder())!
    await flush()
    recorder.state.status = 'recorded'
    recorder.state.hasRecording = true

    permission.change('denied')
    await flush()

    expect(recorder.state.status).toBe('recorded')
    expect(recorder.state.hasRecording).toBe(true)

    scope.stop()
  })

  it('스코프를 벗어나면 권한 구독을 해제한다', async () => {
    const permission = createPermissionStatus('granted')
    stubNavigator(permission.status)

    const scope = effectScope()
    scope.run(() => useVoiceRecorder())
    await flush()
    expect(permission.listenerCount()).toBe(1)

    scope.stop()
    expect(permission.listenerCount()).toBe(0)
  })
})
