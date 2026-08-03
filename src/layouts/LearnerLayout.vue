<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import LearnerHeader from '../components/layout/LearnerHeader.vue'
import GazeCalibrationModal from '../components/common/GazeCalibrationModal.vue'
import GlobalGazeCursor from '../components/common/GlobalGazeCursor.vue'
import { useGazeCalibration } from '../composables/useGazeCalibration'
import { getCachedStudent } from '@/services/learnerDataRepository'
import { fetchDeviceStatus } from '@/services/learnerDataRepository'
import { useDeviceStatus } from '@/composables/useDeviceStatus'
import { useLearnerCanvasScale } from '@/composables/useLearnerCanvasScale'
import { useDeveloperMode } from '@/composables/useDeveloperMode'

const route = useRoute()
const DeveloperCheatMenu = defineAsyncComponent(() => import('@/components/developer/DeveloperCheatMenu.vue'))
const { enabled: isDeveloperMode, registerLogoClick } = useDeveloperMode()
const hideHeader = computed(() => route.meta.hideLearnerHeader === true)
const activeStudent = computed(() => getCachedStudent())
const { isOpen: isGazeCalibrationOpen, close: closeGazeCalibration } = useGazeCalibration()
const { setEyeTrackerConnected, setMicrophoneState } = useDeviceStatus()
const { canvasStyle } = useLearnerCanvasScale()

const handleBrandClick = () => {
  if (route.name === 'learner-home') registerLogoClick()
}

onMounted(async () => {
  try {
    const status = await fetchDeviceStatus()
    setEyeTrackerConnected(status.eyeTrackerConnected)
    setMicrophoneState({
      available: status.microphoneAvailable,
      active: status.microphoneActive,
    })
  } catch {
    // 로컬 gaze bridge 이벤트가 계속 실제 장치 상태를 갱신한다.
  }
})
</script>

<template>
  <div class="learner-viewport">
    <div class="learner-layout" :style="canvasStyle">
      <LearnerHeader
        v-if="!hideHeader"
        :user-name="activeStudent.name"
        @brand-click="handleBrandClick"
      />
      <div class="learner-page" :class="{ 'learner-page--full': hideHeader }">
        <RouterView v-slot="{ Component }">
          <component
            :is="Component"
            :key="route.fullPath"
            :class="{ 'learner-screen-with-header': !hideHeader }"
          />
        </RouterView>
      </div>
    </div>

    <GazeCalibrationModal v-if="isGazeCalibrationOpen" @close="closeGazeCalibration" />
    <GlobalGazeCursor />
    <DeveloperCheatMenu v-if="isDeveloperMode" />
  </div>
</template>

<style scoped src="@/styles/common/LearnerLayout.css"></style>
