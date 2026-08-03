import { computed, ref } from 'vue'
import { getInitialDeviceStatus } from '@/services/learnerDataRepository'

const initialDeviceStatus = getInitialDeviceStatus()
const physicalEyeTrackerConnected = ref<boolean>(initialDeviceStatus.eyeTrackerConnected)
const virtualEyeTrackerConnected = ref(false)
const eyeTrackerConnected = computed(
  () => physicalEyeTrackerConnected.value || virtualEyeTrackerConnected.value,
)
const microphoneAvailable = ref<boolean>(initialDeviceStatus.microphoneAvailable)
const microphoneActive = ref<boolean>(initialDeviceStatus.microphoneActive)

export function useDeviceStatus() {
  const setEyeTrackerConnected = (connected: boolean) => {
    physicalEyeTrackerConnected.value = connected
  }

  const setVirtualEyeTrackerConnected = (connected: boolean) => {
    virtualEyeTrackerConnected.value = connected
  }

  const setMicrophoneState = (state: { available?: boolean; active?: boolean }) => {
    if (typeof state.available === 'boolean') microphoneAvailable.value = state.available
    if (typeof state.active === 'boolean') microphoneActive.value = state.active
    if (!microphoneAvailable.value) microphoneActive.value = false
  }

  return {
    eyeTrackerConnected,
    physicalEyeTrackerConnected,
    virtualEyeTrackerConnected,
    microphoneAvailable,
    microphoneActive,
    setEyeTrackerConnected,
    setVirtualEyeTrackerConnected,
    setMicrophoneState,
  }
}
