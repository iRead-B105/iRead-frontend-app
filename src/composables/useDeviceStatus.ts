import { ref } from 'vue'
import { getInitialDeviceStatus } from '@/services/learnerDataRepository'

const initialDeviceStatus = getInitialDeviceStatus()
const eyeTrackerConnected = ref<boolean>(initialDeviceStatus.eyeTrackerConnected)
const microphoneAvailable = ref<boolean>(initialDeviceStatus.microphoneAvailable)
const microphoneActive = ref<boolean>(initialDeviceStatus.microphoneActive)

export function useDeviceStatus() {
  const setEyeTrackerConnected = (connected: boolean) => {
    eyeTrackerConnected.value = connected
  }

  const setMicrophoneState = (state: { available?: boolean; active?: boolean }) => {
    if (typeof state.available === 'boolean') microphoneAvailable.value = state.available
    if (typeof state.active === 'boolean') microphoneActive.value = state.active
    if (!microphoneAvailable.value) microphoneActive.value = false
  }

  return {
    eyeTrackerConnected,
    microphoneAvailable,
    microphoneActive,
    setEyeTrackerConnected,
    setMicrophoneState,
  }
}
