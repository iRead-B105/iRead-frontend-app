import { afterEach, describe, expect, it } from 'vitest'
import { useDeviceStatus } from './useDeviceStatus'

describe('useDeviceStatus', () => {
  const status = useDeviceStatus()

  afterEach(() => {
    status.setEyeTrackerConnected(false)
    status.setVirtualEyeTrackerConnected(false)
  })

  it('keeps the effective eye tracker connected while the virtual tracker is enabled', () => {
    status.setEyeTrackerConnected(false)
    status.setVirtualEyeTrackerConnected(true)

    expect(status.physicalEyeTrackerConnected.value).toBe(false)
    expect(status.virtualEyeTrackerConnected.value).toBe(true)
    expect(status.eyeTrackerConnected.value).toBe(true)

    status.setEyeTrackerConnected(false)
    expect(status.eyeTrackerConnected.value).toBe(true)
  })

  it('disconnects when neither a physical nor virtual tracker is connected', () => {
    status.setEyeTrackerConnected(false)
    status.setVirtualEyeTrackerConnected(true)
    status.setVirtualEyeTrackerConnected(false)

    expect(status.eyeTrackerConnected.value).toBe(false)
  })
})
