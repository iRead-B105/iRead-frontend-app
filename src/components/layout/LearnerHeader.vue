<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { isNavigationFailure, useRouter } from 'vue-router'
import iReadMainLogo from '../../assets/header/iread-main.png'
import headerCloudBackground from '../../assets/header/iread-header-true-alpha.png'
import defaultAvatar from '../../assets/header/learner-default-avatar.png'
import { useDeviceStatus } from '../../composables/useDeviceStatus'
import { useGazeCalibration } from '../../composables/useGazeCalibration'
import { useGazeCursorVisibility } from '../../composables/useGazeCursorVisibility'
import { useTobiiGazeBridge } from '../../composables/useTobiiGazeBridge'
import { mockGazeSubmissionsEnabled } from '@/features/learner/training'
import { resolveAuthenticatedProfileImage } from '@/features/learner/auth'
import { resolveMicrophoneErrorMessage } from '@/lib/media/microphoneErrorMessage'
import { useLearnerSessionStore } from '@/stores/learnerSession'
import { useLearnerErrorModalStore } from '@/stores/learnerErrorModal'
import eyeTrackerIcon from '@/assets/icons/eye-tracker.svg'
import microphoneIcon from '@/assets/icons/microphone.svg'
import exitIcon from '@/assets/icons/exit.svg'

const props = defineProps<{
  userName: string
  studentId: string
  profileImageUrl?: string | null
}>()
const emit = defineEmits<{ brandClick: [] }>()

const avatarSource = ref(defaultAvatar)

type OpenMenu = 'eye' | 'microphone' | null
type MicrophoneStatus = 'disconnected' | 'connecting' | 'connected' | 'recording' | 'ready' | 'playing'

const router = useRouter()
const learnerSession = useLearnerSessionStore()
const errorModal = useLearnerErrorModalStore()
const menuRoot = ref<HTMLElement | null>(null)
const openMenu = ref<OpenMenu>(null)
const microphoneStatus = ref<MicrophoneStatus>('disconnected')
const displayedEyeTrackerStatus = ref<'connected' | 'connecting' | 'disconnected'>('disconnected')
const microphoneStream = ref<MediaStream | null>(null)
const recordedAudioUrl = ref('')
let recorder: MediaRecorder | null = null
let recordedChunks: Blob[] = []
let testAudio: HTMLAudioElement | null = null
let discardRecording = false
let eyeReconnectFeedbackTimer: number | undefined
let avatarRequestVersion = 0

watch(
  [
    () => props.studentId,
    () => props.profileImageUrl,
    () => learnerSession.accessToken,
  ],
  async ([studentId, profileImageUrl, accessToken]) => {
    const requestVersion = ++avatarRequestVersion
    try {
      const resolved = await resolveAuthenticatedProfileImage(
        studentId ?? '',
        profileImageUrl,
        accessToken,
      )
      if (requestVersion === avatarRequestVersion) avatarSource.value = resolved || defaultAvatar
    } catch {
      if (requestVersion === avatarRequestVersion) avatarSource.value = defaultAvatar
    }
  },
  { immediate: true },
)

const {
  microphoneAvailable,
  microphoneActive,
  setEyeTrackerConnected,
  setMicrophoneState,
} = useDeviceStatus()
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

watch(eyeTrackerStatus, (status) => {
  // 브리지의 자동 재시도는 수 초마다 connecting/disconnected를 오간다.
  // 헤더에는 그 내부 재시도 주기를 노출하지 않고 실제 연결 성공만 즉시 반영한다.
  if (status === 'connected') {
    if (eyeReconnectFeedbackTimer !== undefined) window.clearTimeout(eyeReconnectFeedbackTimer)
    eyeReconnectFeedbackTimer = undefined
    displayedEyeTrackerStatus.value = 'connected'
    return
  }
  if (displayedEyeTrackerStatus.value === 'connected') {
    displayedEyeTrackerStatus.value = 'disconnected'
  }
}, { immediate: true })

watch([microphoneAvailable, microphoneActive], ([available, active]) => {
  if (active) {
    microphoneStatus.value = 'recording'
    return
  }
  if (!available) {
    if (!microphoneStream.value) microphoneStatus.value = 'disconnected'
    return
  }
  if (
    microphoneStatus.value === 'disconnected'
    || microphoneStatus.value === 'connecting'
    || microphoneStatus.value === 'recording'
  ) {
    microphoneStatus.value = 'connected'
  }
}, { immediate: true })

const microphoneStatusLabel = computed(() => ({
  disconnected: '마이크 연결 안 됨',
  connecting: '마이크 확인 중…',
  connected: '마이크 연결됨',
  recording: '테스트 녹음 중…',
  ready: '테스트 녹음 완료',
  playing: '테스트 소리 재생 중…',
})[microphoneStatus.value])

const toggleMenu = (menu: Exclude<OpenMenu, null>) => {
  openMenu.value = openMenu.value === menu ? null : menu
}

const startCalibration = () => {
  openMenu.value = null
  openGazeCalibration()
}

const reconnectFromMenu = () => {
  if (eyeReconnectFeedbackTimer !== undefined) window.clearTimeout(eyeReconnectFeedbackTimer)
  displayedEyeTrackerStatus.value = 'connecting'
  reconnectEyeTracker()
  eyeReconnectFeedbackTimer = window.setTimeout(() => {
    if (eyeTrackerStatus.value !== 'connected') displayedEyeTrackerStatus.value = 'disconnected'
    eyeReconnectFeedbackTimer = undefined
  }, 2200)
}
const disconnectFromMenu = () => {
  if (eyeReconnectFeedbackTimer !== undefined) window.clearTimeout(eyeReconnectFeedbackTimer)
  eyeReconnectFeedbackTimer = undefined
  displayedEyeTrackerStatus.value = 'disconnected'
  disconnectEyeTracker()
}

const revokeRecordedAudio = () => {
  if (recordedAudioUrl.value) URL.revokeObjectURL(recordedAudioUrl.value)
  recordedAudioUrl.value = ''
}

const stopMicrophoneTracks = () => {
  microphoneStream.value?.getTracks().forEach((track) => track.stop())
  microphoneStream.value = null
}

const emitMicrophoneState = (available: boolean, active = false) => {
  setMicrophoneState({ available, active })
  window.dispatchEvent(new CustomEvent('iread:microphone-state', {
    detail: { available, active },
  }))
}

const connectMicrophone = async (keepStream = false) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    errorModal.show('마이크를 사용할 수 없는 환경이에요')
    return
  }

  microphoneStatus.value = 'connecting'
  try {
    stopMicrophoneTracks()
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (keepStream) microphoneStream.value = stream
    else stream.getTracks().forEach((track) => track.stop())
    microphoneStatus.value = 'connected'
    emitMicrophoneState(true)
  } catch (error) {
    microphoneStatus.value = 'disconnected'
    emitMicrophoneState(false)
    errorModal.show(resolveMicrophoneErrorMessage(error), '마이크 연결 오류')
  }
}

const disconnectMicrophone = () => {
  discardRecording = true
  recorder?.state === 'recording' && recorder.stop()
  recorder = null
  testAudio?.pause()
  testAudio = null
  stopMicrophoneTracks()
  revokeRecordedAudio()
  microphoneStatus.value = 'disconnected'
  emitMicrophoneState(false)
}

const recordMicrophoneTest = async () => {
  if (!microphoneStream.value) await connectMicrophone(true)
  if (!microphoneStream.value || typeof MediaRecorder === 'undefined') {
    if (typeof MediaRecorder === 'undefined') errorModal.show('녹음 기능을 지원하지 않는 브라우저예요')
    return
  }

  revokeRecordedAudio()
  recordedChunks = []
  discardRecording = false
  recorder = new MediaRecorder(microphoneStream.value)
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size) recordedChunks.push(event.data)
  })
  recorder.addEventListener('stop', () => {
    if (discardRecording) return
    const type = recorder?.mimeType || 'audio/webm'
    recordedAudioUrl.value = URL.createObjectURL(new Blob(recordedChunks, { type }))
    microphoneStatus.value = 'ready'
    emitMicrophoneState(true)
  }, { once: true })
  recorder.start()
  microphoneStatus.value = 'recording'
  emitMicrophoneState(true, true)
}

const stopMicrophoneTest = () => {
  if (recorder?.state === 'recording') recorder.stop()
}

const playMicrophoneTest = async () => {
  if (!recordedAudioUrl.value) return
  testAudio?.pause()
  testAudio = new Audio(recordedAudioUrl.value)
  testAudio.addEventListener('ended', () => {
    microphoneStatus.value = 'ready'
  }, { once: true })
  microphoneStatus.value = 'playing'
  try {
    await testAudio.play()
  } catch (error) {
    microphoneStatus.value = 'ready'
    errorModal.show(error, '마이크 테스트 재생 오류')
  }
}

const handleMicrophoneState = (event: Event) => {
  const detail = (event as CustomEvent<{ active?: boolean; available?: boolean }>).detail
  setMicrophoneState(detail ?? {})
}

const handleEyeTrackerState = (event: Event) => {
  const detail = (event as CustomEvent<{ connected?: boolean }>).detail
  if (typeof detail?.connected === 'boolean') setEyeTrackerConnected(detail.connected)
}

const closeMenusFromOutside = (event: PointerEvent) => {
  if (!menuRoot.value?.contains(event.target as Node)) openMenu.value = null
}

const closeMenusFromEscape = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return
  openMenu.value = null
  nextTick(() => menuRoot.value?.querySelector<HTMLButtonElement>('.device-button')?.focus())
}

onMounted(() => {
  window.addEventListener('iread:microphone-state', handleMicrophoneState)
  window.addEventListener('iread:eye-tracker-state', handleEyeTrackerState)
  document.addEventListener('pointerdown', closeMenusFromOutside)
  document.addEventListener('keydown', closeMenusFromEscape)
})

onBeforeUnmount(() => {
  window.removeEventListener('iread:microphone-state', handleMicrophoneState)
  window.removeEventListener('iread:eye-tracker-state', handleEyeTrackerState)
  document.removeEventListener('pointerdown', closeMenusFromOutside)
  document.removeEventListener('keydown', closeMenusFromEscape)
  if (eyeReconnectFeedbackTimer !== undefined) window.clearTimeout(eyeReconnectFeedbackTimer)
  disconnectMicrophone()
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
          <img
            :src="avatarSource"
            :class="{ 'avatar-image--fallback': avatarSource === defaultAvatar }"
            alt=""
          />
        </span>
        <strong>{{ userName }}</strong>
      </div>
    </div>

    <RouterLink class="brand" :to="{ name: 'learner-home' }" aria-label="아이리드 홈으로 이동" @click="emit('brandClick')">
      <img :src="iReadMainLogo" alt="아이리드" />
    </RouterLink>

    <nav ref="menuRoot" class="device-actions" aria-label="학습 장치 상태와 나가기">
      <div class="device-button-wrap">
        <button
          type="button"
          class="device-button device-button--interactive"
          :class="{
            active: displayedEyeTrackerStatus === 'connected',
            connecting: displayedEyeTrackerStatus === 'connecting',
            disconnected: displayedEyeTrackerStatus === 'disconnected',
          }"
          :aria-label="displayedEyeTrackerStatus === 'connected' ? '아이트래커 연결됨' : displayedEyeTrackerStatus === 'connecting' ? '아이트래커 연결 중' : '아이트래커 연결 안 됨'"
          :aria-expanded="openMenu === 'eye'"
          aria-haspopup="menu"
          @click="toggleMenu('eye')"
        >
          <span class="device-icon" aria-hidden="true">
            <img class="eyes-icon" :src="eyeTrackerIcon" alt="" />
            <i></i>
          </span>
          <span class="visually-hidden">시선 장치</span>
        </button>

        <Transition name="device-menu">
          <section v-if="openMenu === 'eye'" class="device-menu device-menu--eye" role="menu" aria-label="아이트래커 메뉴">
            <div class="device-menu-heading">
              <span class="device-menu-heading-icon" aria-hidden="true">
                <img class="eyes-icon" :src="eyeTrackerIcon" alt="" />
              </span>
              <div>
                <strong>아이트래커</strong>
                <span class="device-status" :data-state="displayedEyeTrackerStatus">
                  <i></i>
                  {{ displayedEyeTrackerStatus === 'connected' ? '연결됨' : displayedEyeTrackerStatus === 'connecting' ? '연결 시도 중' : '연결 안 됨' }}
                </span>
              </div>
            </div>

            <div class="device-menu-primary-slot">
              <button
                v-if="displayedEyeTrackerStatus === 'connected'"
                type="button"
                class="device-menu-button device-menu-button--primary"
                role="menuitem"
                @click="startCalibration"
              >
                시선 다시 맞추기
              </button>
              <button
                v-else
                type="button"
                class="device-menu-button device-menu-button--primary"
                role="menuitem"
                :disabled="displayedEyeTrackerStatus === 'connecting'"
                @click="reconnectFromMenu"
              >
                {{ displayedEyeTrackerStatus === 'connecting' ? '연결하고 있어요…' : '다시 연결하기' }}
              </button>
            </div>

            <div class="device-menu-section">
              <div class="device-menu-setting">
                <span>시선 포인터</span>
                <button class="device-toggle" type="button" :aria-pressed="isCursorVisible" @click="toggleCursorVisibility">
                  <span>{{ isCursorVisible ? '켜짐' : '꺼짐' }}</span><i></i>
                </button>
              </div>
              <div class="device-menu-setting device-menu-setting--stack">
                <span>포인터 크기</span>
                <div class="device-segment" role="group" aria-label="시선 포인터 크기">
                  <button
                    v-for="option in [
                      { value: 'small', label: '작게' },
                      { value: 'medium', label: '보통' },
                      { value: 'large', label: '크게' },
                    ]"
                    :key="option.value"
                    type="button"
                    :class="{ active: cursorSize === option.value }"
                    :aria-pressed="cursorSize === option.value"
                    @click="setCursorSize(option.value as 'small' | 'medium' | 'large')"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
              <div class="device-menu-setting">
                <span>시선으로 버튼 누르기</span>
                <button class="device-toggle" type="button" :aria-pressed="isButtonInteractionEnabled" @click="toggleButtonInteraction">
                  <span>{{ isButtonInteractionEnabled ? '켜짐' : '꺼짐' }}</span><i></i>
                </button>
              </div>
            </div>

            <button
              type="button"
              class="device-menu-button device-menu-button--quiet"
              role="menuitem"
              :disabled="displayedEyeTrackerStatus === 'disconnected'"
              @click="disconnectFromMenu"
            >
              연결 해제
            </button>
          </section>
        </Transition>
      </div>

      <div class="device-button-wrap">
        <button
          type="button"
          class="device-button device-button--voice device-button--interactive"
          :class="{
            active: microphoneActive,
            available: microphoneStatus !== 'disconnected' && !microphoneActive,
            disconnected: microphoneStatus === 'disconnected',
          }"
          :aria-label="microphoneStatusLabel"
          :aria-expanded="openMenu === 'microphone'"
          aria-haspopup="menu"
          @click="toggleMenu('microphone')"
        >
          <span class="device-icon" aria-hidden="true">
            <img class="microphone-icon" :src="microphoneIcon" alt="" />
            <i></i>
          </span>
          <span class="visually-hidden">마이크</span>
        </button>

        <Transition name="device-menu">
          <section v-if="openMenu === 'microphone'" class="device-menu device-menu--microphone" role="menu" aria-label="마이크 메뉴">
            <div class="device-menu-heading">
              <span class="device-menu-heading-icon device-menu-heading-icon--mic" aria-hidden="true">
                <img class="microphone-icon" :src="microphoneIcon" alt="" />
              </span>
              <div>
                <strong>마이크</strong>
                <span class="device-status" :data-state="microphoneStatus">
                  <i></i>{{ microphoneStatusLabel }}
                </span>
              </div>
            </div>

            <div class="device-menu-primary-slot">
              <button
                v-if="microphoneStatus === 'disconnected' || microphoneStatus === 'connecting'"
                type="button"
                class="device-menu-button device-menu-button--primary"
                :disabled="microphoneStatus === 'connecting'"
                @click="connectMicrophone()"
              >
                {{ microphoneStatus === 'connecting' ? '확인하고 있어요…' : '마이크 연결 확인' }}
              </button>
              <button
                v-else-if="microphoneStatus === 'recording'"
                type="button"
                class="device-menu-button device-menu-button--recording"
                @click="stopMicrophoneTest"
              >
                <i></i> 녹음 끝내기
              </button>
              <button
                v-else
                type="button"
                class="device-menu-button device-menu-button--primary"
                @click="recordMicrophoneTest"
              >
                테스트 녹음 시작
              </button>
            </div>

            <div class="microphone-test">
              <div class="microphone-wave" :class="{ active: microphoneStatus === 'recording' || microphoneStatus === 'playing' }" aria-hidden="true">
                <i v-for="bar in 13" :key="bar"></i>
              </div>
              <p>짧게 녹음한 소리는 저장되지 않아요.</p>
              <button
                type="button"
                class="device-menu-button device-menu-button--play"
                :disabled="!recordedAudioUrl || microphoneStatus === 'recording'"
                @click="playMicrophoneTest"
              >
                {{ microphoneStatus === 'playing' ? '재생 중…' : '내 목소리 들어보기' }}
              </button>
            </div>

            <button
              type="button"
              class="device-menu-button device-menu-button--quiet"
              :disabled="microphoneStatus === 'disconnected'"
              @click="disconnectMicrophone"
            >
              마이크 연결 해제
            </button>
          </section>
        </Transition>
      </div>

      <button class="exit-button" type="button" aria-label="로그아웃하고 나가기" @click="handleLogout">
        <img class="exit-icon" :src="exitIcon" alt="" aria-hidden="true" />
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

.device-menu {
  position: absolute;
  z-index: 60;
  top: calc(100% + 14px);
  right: 0;
  width: 326px;
  box-sizing: border-box;
  padding: 18px;
  border: 3px solid rgb(255 255 255 / 96%);
  border-radius: 28px;
  background: linear-gradient(180deg, #ffffff 0%, #fffaf0 100%);
  box-shadow: 0 10px 0 rgb(99 133 164 / 14%), 0 24px 55px rgb(32 63 94 / 25%);
  color: #173454;
}

.device-menu::before {
  position: absolute;
  top: -10px;
  right: 23px;
  width: 18px;
  height: 18px;
  border-top: 3px solid #fff;
  border-left: 3px solid #fff;
  background: #fff;
  content: '';
  transform: rotate(45deg);
}

.device-menu--eye {
  min-height: 466px;
}

.device-menu--microphone {
  min-height: 386px;
}

.device-menu-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 58px;
  padding: 0 2px 14px;
  border-bottom: 2px dashed #dbe9f2;
}

.device-menu-heading-icon {
  width: 50px;
  height: 50px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 17px;
  background: #e3f5ff;
}

.device-menu-heading-icon svg {
  width: 38px;
  height: 38px;
}

.device-menu-heading-icon--mic {
  background: #fff0dc;
}

.device-menu-heading strong {
  display: block;
  margin-bottom: 3px;
  font-size: 21px;
  font-weight: var(--learner-font-weight-heavy);
}

.device-status {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 145px;
  color: #617990;
  font-size: 15px;
  font-weight: var(--learner-font-weight-bold);
}

.device-status i {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #ef5c61;
}

.device-status[data-state='connected'] i,
.device-status[data-state='ready'] i {
  background: #3cbf6a;
}

.device-status[data-state='connecting'] i,
.device-status[data-state='playing'] i {
  background: #438af0;
  animation: status-pulse 1s ease-in-out infinite;
}

.device-status[data-state='recording'] i {
  background: #ef5c61;
  animation: status-pulse .75s ease-in-out infinite;
}

.device-menu-primary-slot {
  min-height: 66px;
  display: grid;
  align-items: center;
  padding-top: 12px;
}

.device-menu-button {
  width: 100%;
  min-height: 48px;
  border: 0;
  border-radius: 15px;
  font-family: var(--learner-font-display);
  font-size: 16px;
  font-weight: var(--learner-font-weight-heavy);
  cursor: pointer;
  transition: transform var(--learner-duration-fast), filter var(--learner-duration-fast), box-shadow var(--learner-duration-fast);
}

.device-menu-button:not(:disabled):hover {
  transform: translateY(-2px);
  filter: brightness(1.04);
}

.device-menu-button:not(:disabled):active {
  transform: translateY(1px);
}

.device-menu-button:focus-visible,
.device-segment button:focus-visible,
.device-toggle:focus-visible {
  outline: 4px solid rgb(67 138 240 / 28%);
  outline-offset: 2px;
}

.device-menu-button:disabled {
  cursor: not-allowed;
  opacity: .52;
}

.device-menu-button--primary {
  background: #5573df;
  color: #fff;
  box-shadow: 0 5px 0 #344eb1;
}

.device-menu-button--recording {
  background: #fff0f0;
  color: #c53e45;
  box-shadow: inset 0 0 0 2px #ffc9cc;
}

.device-menu-button--recording i {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 5px;
  border-radius: 50%;
  background: #ef5c61;
  animation: status-pulse .75s ease-in-out infinite;
}

.device-menu-button--quiet {
  min-height: 42px;
  margin-top: 12px;
  background: #eef4f7;
  color: #5b7185;
}

.device-menu-button--play {
  min-height: 42px;
  background: #fff;
  color: #42627d;
  box-shadow: inset 0 0 0 2px #cfe1ea;
}

.device-menu-section {
  display: grid;
  gap: 2px;
  padding: 8px 0;
  border-top: 2px dashed #dbe9f2;
  border-bottom: 2px dashed #dbe9f2;
}

.device-menu-setting {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #294964;
  font-size: 17px;
  font-weight: var(--learner-font-weight-heavy);
  letter-spacing: -.02em;
}

.device-menu-setting--stack {
  display: grid;
  gap: 8px;
  padding: 7px 0 10px;
}

.device-toggle {
  width: 68px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  padding: 4px 6px;
  border: 0;
  border-radius: 999px;
  background: #d7e0e7;
  color: #657687;
  font-family: inherit;
  font-size: 12px;
  font-weight: var(--learner-font-weight-heavy);
  cursor: pointer;
}

.device-toggle i {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 5px rgb(50 78 101 / 20%);
}

.device-toggle[aria-pressed='true'] {
  justify-content: flex-start;
  background: #50c77a;
  color: #fff;
}

.device-toggle[aria-pressed='true'] i {
  order: -1;
}

.device-segment {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 4px;
  border-radius: 14px;
  background: #edf2f6;
}

.device-segment button {
  min-height: 34px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #698095;
  font-family: inherit;
  font-size: 15px;
  font-weight: var(--learner-font-weight-heavy);
  cursor: pointer;
}

.device-segment button.active {
  background: #fff;
  color: #3e58ba;
  box-shadow: 0 2px 8px rgb(54 76 102 / 15%);
}

.microphone-test {
  min-height: 164px;
  display: grid;
  align-content: center;
  gap: 10px;
  padding: 12px 0 2px;
  text-align: center;
}

.microphone-test p {
  margin: 0;
  color: #73889b;
  font-size: 13px;
  font-weight: 750;
}

.microphone-wave {
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.microphone-wave i {
  width: 5px;
  height: 8px;
  border-radius: 99px;
  background: #b9cbd6;
}

.microphone-wave.active i {
  background: #5c7de4;
  animation: wave-bar .8s ease-in-out infinite alternate;
}

.microphone-wave.active i:nth-child(3n) { animation-delay: -.2s; }
.microphone-wave.active i:nth-child(3n + 1) { animation-delay: -.45s; }
.microphone-wave.active i:nth-child(3n + 2) { animation-delay: -.65s; }

.device-menu-enter-active,
.device-menu-leave-active {
  transition: opacity .16s ease, transform .16s ease;
  transform-origin: top right;
}

.device-menu-enter-from,
.device-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(.98);
}

@keyframes status-pulse {
  50% { opacity: .35; transform: scale(.75); }
}

@keyframes wave-bar {
  to { height: 34px; }
}

@media (prefers-reduced-motion: reduce) {
  .device-menu,
  .device-status i,
  .microphone-wave i,
  .device-menu-button {
    animation: none !important;
    transition: none !important;
  }
}
</style>
