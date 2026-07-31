<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { isNavigationFailure, useRouter } from 'vue-router'
import iReadMainLogo from '../../assets/header/iread-main.png'
import headerCloudBackground from '../../assets/header/iread-header-true-alpha.png'
import { useDeviceStatus } from '../../composables/useDeviceStatus'
import { useGazeCalibration } from '../../composables/useGazeCalibration'
import { useGazeCursorVisibility } from '../../composables/useGazeCursorVisibility'
import { useTobiiGazeBridge } from '../../composables/useTobiiGazeBridge'
import { mockGazeSubmissionsEnabled } from '@/features/learner/training'
import { useLearnerSessionStore } from '@/stores/learnerSession'

defineProps<{ userName: string }>()

const router = useRouter()
const learnerSession = useLearnerSessionStore()
const {
  microphoneAvailable,
  microphoneActive,
  setEyeTrackerConnected,
  setMicrophoneState,
} = useDeviceStatus()

const showEyeMenu = ref(false)
const { open: openGazeCalibration } = useGazeCalibration()
const {
  isCursorVisible,
  cursorSize,
  isButtonInteractionEnabled,
  toggleCursorVisibility,
  setCursorSize,
  toggleButtonInteraction,
} = useGazeCursorVisibility()
const {
  status: eyeTrackerStatus,
  disconnect: disconnectEyeTracker,
  reconnect: reconnectEyeTracker,
} = useTobiiGazeBridge({ autoConnect: !mockGazeSubmissionsEnabled })
const startCalibration = () => {
  showEyeMenu.value = false
  openGazeCalibration()
}
const reconnectFromMenu = () => {
  showEyeMenu.value = false
  reconnectEyeTracker()
}
const disconnectFromMenu = () => {
  showEyeMenu.value = false
  disconnectEyeTracker()
}

const handleMicrophoneState = (event: Event) => {
  const detail = (event as CustomEvent<{ active?: boolean; available?: boolean }>).detail
  setMicrophoneState(detail ?? {})
}

const handleEyeTrackerState = (event: Event) => {
  const detail = (event as CustomEvent<{ connected?: boolean }>).detail
  if (typeof detail?.connected === 'boolean') setEyeTrackerConnected(detail.connected)
}

onMounted(() => {
  window.addEventListener('iread:microphone-state', handleMicrophoneState)
  window.addEventListener('iread:eye-tracker-state', handleEyeTrackerState)
})
onBeforeUnmount(() => {
  window.removeEventListener('iread:microphone-state', handleMicrophoneState)
  window.removeEventListener('iread:eye-tracker-state', handleEyeTrackerState)
})

const handleLogout = async () => {
  await learnerSession.logout()
  const navigationResult = await router.replace({ name: 'learner-login' })
  if (isNavigationFailure(navigationResult)) return
}
</script>

<template>
  <header class="learner-header">
    <img class="header-cloud-background" :src="headerCloudBackground" alt="" aria-hidden="true" />

    <div class="profile-cluster">
      <div class="profile" :aria-label="`${userName} 프로필`">
        <span class="avatar" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <circle class="avatar-bg" cx="32" cy="32" r="30" />
            <circle class="avatar-hair-side" cx="14" cy="30" r="10" />
            <circle class="avatar-hair-side" cx="50" cy="30" r="10" />
            <path class="avatar-hair" d="M14 31c0-15 8-24 18-24s18 9 18 24v8H14v-8Z" />
            <circle class="avatar-face" cx="32" cy="32" r="17" />
            <path class="avatar-bangs" d="M16 27c3-12 9-18 17-18 9 0 15 7 16 19-5-1-9-4-12-8-4 5-11 8-21 7Z" />
            <circle class="avatar-eye" cx="25" cy="33" r="2.1" />
            <circle class="avatar-eye" cx="39" cy="33" r="2.1" />
            <path class="avatar-smile" d="M27 40c3 3 7 3 10 0" />
            <path class="avatar-shirt" d="M18 58c2-10 7-14 14-14s12 4 14 14H18Z" />
            <circle class="avatar-star" cx="32" cy="51" r="3" />
          </svg>
        </span>
        <strong>{{ userName }}</strong>
      </div>
    </div>

    <RouterLink class="brand" :to="{ name: 'learner-home' }" aria-label="아이리드 홈으로 이동">
      <img :src="iReadMainLogo" alt="아이리드" />
    </RouterLink>

    <nav class="device-actions" aria-label="학습 장치 상태와 나가기">
      <div class="device-button-wrap">
        <button
          type="button"
          class="device-button"
          :class="{
            active: eyeTrackerStatus === 'connected',
            connecting: eyeTrackerStatus === 'connecting',
            disconnected: eyeTrackerStatus === 'disconnected',
          }"
          :aria-label="eyeTrackerStatus === 'connected' ? '아이트래커 연결됨' : eyeTrackerStatus === 'connecting' ? '아이트래커 연결 중' : '아이트래커 연결 안 됨'"
          :aria-expanded="showEyeMenu"
          @click="showEyeMenu = !showEyeMenu"
        >
          <span class="device-icon" aria-hidden="true">
            <svg class="eyes-icon" viewBox="0 0 48 48">
              <ellipse class="eye-white" cx="15" cy="24" rx="10" ry="14" />
              <ellipse class="eye-white" cx="33" cy="24" rx="10" ry="14" />
              <ellipse class="eye-pupil" cx="17" cy="26" rx="5.5" ry="8" />
              <ellipse class="eye-pupil" cx="35" cy="26" rx="5.5" ry="8" />
              <circle class="eye-shine" cx="19" cy="22" r="2.2" />
              <circle class="eye-shine" cx="37" cy="22" r="2.2" />
            </svg>
            <i></i>
          </span>
          <span class="visually-hidden">시선</span>
        </button>
        <div v-if="showEyeMenu" class="eye-tracker-menu" role="menu" aria-label="아이트래커 메뉴">
          <p class="eye-tracker-menu-status" :data-state="eyeTrackerStatus">
            {{ eyeTrackerStatus === 'connected' ? '아이트래커 연결됨' : eyeTrackerStatus === 'connecting' ? '아이트래커 연결 중...' : '아이트래커 연결 안 됨' }}
          </p>
          <button v-if="eyeTrackerStatus !== 'connected'" type="button" class="eye-tracker-menu-item" role="menuitem" @click="reconnectFromMenu">
            재연결
          </button>
          <button v-if="eyeTrackerStatus !== 'disconnected'" type="button" class="eye-tracker-menu-item eye-tracker-menu-item--secondary" role="menuitem" @click="disconnectFromMenu">
            연결 해제
          </button>
          <button v-if="eyeTrackerStatus === 'connected'" type="button" class="eye-tracker-menu-item" role="menuitem" @click="startCalibration">
            보정하기
          </button>
          <button
            type="button"
            class="eye-tracker-menu-item eye-tracker-menu-item--secondary"
            role="menuitem"
            :aria-pressed="isCursorVisible"
            @click="toggleCursorVisibility"
          >
            {{ isCursorVisible ? '시선 원 숨기기' : '시선 원 보이기' }}
          </button>
          <div class="eye-tracker-menu-section">
            <p class="eye-tracker-menu-label">시선 인식 원 크기</p>
            <div class="eye-tracker-size-options" role="group" aria-label="시선 인식 원 크기">
              <button
                v-for="option in [
                  { value: 'small', label: '작게' },
                  { value: 'medium', label: '보통' },
                  { value: 'large', label: '크게' },
                ]"
                :key="option.value"
                type="button"
                class="eye-tracker-size-button"
                :class="{ active: cursorSize === option.value }"
                :aria-pressed="cursorSize === option.value"
                @click="setCursorSize(option.value as 'small' | 'medium' | 'large')"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          <button
            type="button"
            class="eye-tracker-menu-item"
            :class="{ 'eye-tracker-menu-item--enabled': isButtonInteractionEnabled }"
            role="menuitem"
            :aria-pressed="isButtonInteractionEnabled"
            @click="toggleButtonInteraction"
          >
            아이트래킹 버튼 인터랙션 {{ isButtonInteractionEnabled ? '끄기' : '켜기' }}
          </button>
        </div>
      </div>

      <div
        class="device-button device-button--voice"
        :class="{
          active: microphoneActive,
          available: microphoneAvailable && !microphoneActive,
          disconnected: !microphoneAvailable,
        }"
        role="status"
        :aria-label="!microphoneAvailable ? '마이크 연결 안 됨' : microphoneActive ? '음성 인식 중' : '마이크 연결됨'"
      >
        <span class="device-icon" aria-hidden="true">
          <svg class="microphone-icon" viewBox="0 0 48 48">
            <rect class="mic-body" x="17" y="7" width="14" height="24" rx="7" />
            <path class="mic-line" d="M11.5 25.5a12.5 12.5 0 0 0 25 0M24 38v5M17 43h14" />
            <path class="mic-shine" d="M21 12v10" />
          </svg>
          <i></i>
        </span>
        <span class="visually-hidden">음성</span>
      </div>

      <button class="exit-button" type="button" aria-label="로그아웃하고 나가기" @click="handleLogout">
        <svg class="exit-icon" viewBox="0 0 48 48" aria-hidden="true">
          <path class="exit-door" d="M7 7h20v34H7z" />
          <path class="exit-door-face" d="m12 11 15-4v34l-15-4z" />
          <circle class="exit-knob" cx="23" cy="25" r="1.8" />
          <path class="exit-arrow" d="M23 24h18M34 17l7 7-7 7" />
        </svg>
        <span class="visually-hidden">나가기</span>
      </button>
    </nav>

  </header>
</template>

<style scoped src="@/styles/common/LearnerHeader.css"></style>
<style scoped>
.device-button-wrap {
  position: relative;
}
.eye-tracker-menu {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 60;
  min-width: 220px;
  padding: 14px;
  border-radius: 20px;
  background: #fffdf8;
  border: 3px solid #eadfbf;
  box-shadow: 0 16px 40px rgb(40 65 95 / 0.28);
  display: grid;
  gap: 10px;
}
.eye-tracker-menu-status {
  margin: 0;
  padding: 4px 10px;
  color: #4d668a;
  font-size: 15px;
  font-weight: 800;
}
.eye-tracker-menu-item {
  min-height: 48px;
  border: 0;
  border-radius: 14px;
  background: #5d6fe8;
  color: #fff;
  font-family: var(--learner-font-display);
  font-size: 18px;
  font-weight: 900;
  cursor: pointer;
}
.eye-tracker-menu-item:hover {
  background: #4454c9;
}
.eye-tracker-menu-section {
  display: grid;
  gap: 7px;
}
.eye-tracker-menu-label {
  margin: 0;
  padding: 0 5px;
  color: #4d668a;
  font-size: 14px;
  font-weight: 900;
}
.eye-tracker-size-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.eye-tracker-size-button {
  min-height: 40px;
  border: 2px solid #d9ddf8;
  border-radius: 12px;
  background: #f4f5ff;
  color: #59658c;
  font-family: var(--learner-font-display);
  font-size: 15px;
  font-weight: 900;
  cursor: pointer;
}
.eye-tracker-size-button.active {
  border-color: #5d6fe8;
  background: #e6e9ff;
  color: #3445ba;
}
.eye-tracker-menu-item--enabled {
  background: #238b67;
}
.eye-tracker-menu-item--enabled:hover {
  background: #187455;
}
</style>
