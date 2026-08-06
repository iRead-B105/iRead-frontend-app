// @vitest-environment jsdom

// 회귀 방지: 마이크 연결 확인을 끝낸 뒤 사용자가 크롬에서 마이크 권한을 끄면
// 헤더가 계속 "마이크 연결됨"으로 남아 있었다. 권한이 사라지면 화면과 공용
// 장치 상태가 함께 되돌아가야 한다.

import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useDeviceStatus } from '@/composables/useDeviceStatus'

vi.mock('@/composables/useTobiiGazeBridge', () => ({
  useTobiiGazeBridge: () => ({
    connected: ref(false),
    connecting: ref(false),
    status: ref<'disconnected'>('disconnected'),
    connect: vi.fn(),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
  }),
}))

vi.mock('@/composables/useGazeCalibration', () => ({
  useGazeCalibration: () => ({ open: vi.fn(), close: vi.fn(), isOpen: ref(false) }),
}))

vi.mock('@/features/learner/auth', () => ({
  resolveAuthenticatedProfileImage: () => Promise.resolve(''),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: vi.fn(() => Promise.resolve()) }),
  isNavigationFailure: () => false,
  RouterLink: { template: '<a><slot /></a>' },
}))

import LearnerHeader from './LearnerHeader.vue'

type ChangeListener = () => void

const createPermissionStatus = (state: PermissionState) => {
  const listeners = new Set<ChangeListener>()
  return {
    status: {
      state,
      addEventListener: (_type: string, listener: ChangeListener) => listeners.add(listener),
      removeEventListener: (_type: string, listener: ChangeListener) => listeners.delete(listener),
    },
    change(next: PermissionState) {
      this.status.state = next
      listeners.forEach((listener) => listener())
    },
  }
}

const createAudioTrack = () => ({
  stop: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})

const mountHeader = () =>
  mount(LearnerHeader, {
    props: { userName: '샛별', studentId: '2001', profileImageUrl: null },
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, Transition: false } },
  })

const openMicrophoneMenu = async (wrapper: ReturnType<typeof mountHeader>) => {
  await wrapper.find('.device-button--voice').trigger('click')
  await flushPromises()
}

const microphoneStatusText = (wrapper: ReturnType<typeof mountHeader>) =>
  wrapper.find('.device-menu--microphone .device-status').text()

describe('LearnerHeader 마이크 권한 반영', () => {
  const deviceStatus = useDeviceStatus()

  beforeEach(() => {
    setActivePinia(createPinia())
    deviceStatus.setMicrophoneState({ available: false, active: false })
  })

  it('연결 확인 뒤 브라우저에서 권한을 끄면 권한 없음으로 되돌린다', async () => {
    const permission = createPermissionStatus('granted')
    const track = createAudioTrack()
    vi.stubGlobal('navigator', {
      permissions: { query: () => Promise.resolve(permission.status) },
      mediaDevices: { getUserMedia: () => Promise.resolve({ getTracks: () => [track] }) },
    })

    const wrapper = mountHeader()
    await flushPromises()
    await openMicrophoneMenu(wrapper)

    // 아동이 "마이크 연결 확인"을 눌러 권한을 허용한 상태.
    await wrapper.find('.device-menu-button--primary').trigger('click')
    await flushPromises()
    expect(microphoneStatusText(wrapper)).toContain('마이크 연결됨')
    expect(deviceStatus.microphoneAvailable.value).toBe(true)

    // 사용자가 크롬 사이트 설정에서 마이크를 차단한다.
    permission.change('denied')
    await flushPromises()

    expect(microphoneStatusText(wrapper)).toContain('마이크 권한 없음')
    expect(deviceStatus.microphoneAvailable.value).toBe(false)
    expect(wrapper.find('.microphone-permission-hint').exists()).toBe(true)
    // 권한이 없으면 다시 연결을 확인할 수 있어야 한다.
    expect(wrapper.find('.device-menu-button--primary').text()).toContain('마이크 연결 확인')

    wrapper.unmount()
  })

  it('처음부터 차단된 브라우저에서는 마운트 시점에 권한 없음으로 표시한다', async () => {
    const permission = createPermissionStatus('denied')
    vi.stubGlobal('navigator', {
      permissions: { query: () => Promise.resolve(permission.status) },
      mediaDevices: { getUserMedia: () => Promise.reject(new Error('blocked')) },
    })

    const wrapper = mountHeader()
    await flushPromises()
    await openMicrophoneMenu(wrapper)

    expect(microphoneStatusText(wrapper)).toContain('마이크 권한 없음')
    expect(deviceStatus.microphoneAvailable.value).toBe(false)

    wrapper.unmount()
  })

  it('권한을 다시 허용하면 연결 확인부터 할 수 있게 되돌린다', async () => {
    const permission = createPermissionStatus('denied')
    vi.stubGlobal('navigator', {
      permissions: { query: () => Promise.resolve(permission.status) },
      mediaDevices: { getUserMedia: () => Promise.resolve({ getTracks: () => [createAudioTrack()] }) },
    })

    const wrapper = mountHeader()
    await flushPromises()
    await openMicrophoneMenu(wrapper)
    expect(microphoneStatusText(wrapper)).toContain('마이크 권한 없음')

    permission.change('granted')
    await flushPromises()

    expect(microphoneStatusText(wrapper)).toContain('마이크 연결 안 됨')
    expect(wrapper.find('.microphone-permission-hint').exists()).toBe(false)

    wrapper.unmount()
  })
})
