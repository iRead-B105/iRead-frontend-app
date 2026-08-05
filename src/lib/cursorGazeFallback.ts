import { computed } from 'vue'
import { useDeviceStatus } from '@/composables/useDeviceStatus'

// 커서(마우스) 좌표를 시선 데이터 대신 사용하는 폴백 스위치.
// 아이트래커(실물·가상)가 연결되어 있지 않으면 자동으로 켜져 마우스로도
// 학습을 진행할 수 있다. 트래커가 연결되면 꺼져서 마우스 움직임이 실제
// 시선 데이터로 백엔드에 저장되는 것을 막는다.
const { eyeTrackerConnected } = useDeviceStatus()

export const cursorGazeFallbackActive = computed(
  () => !eyeTrackerConnected.value,
)
