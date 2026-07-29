import { ref } from 'vue'

// 전역 시선 보정 모달 열림 상태(싱글톤). 헤더 아이콘 → 메뉴 → 보정하기로 어디서든 열 수 있다.
const isOpen = ref(false)

export const useGazeCalibration = () => {
  const open = () => {
    isOpen.value = true
  }
  const close = () => {
    isOpen.value = false
  }
  const toggle = () => {
    isOpen.value = !isOpen.value
  }
  return { isOpen, open, close, toggle }
}
