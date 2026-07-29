// ref는 값 변경을 화면에 반영하고, onUnmounted는 화면이 사라질 때 정리 작업을 실행합니다.
import { onUnmounted, ref } from 'vue'

// 여러 화면에서 재사용하는 '잠시 보이는 알림' 기능입니다. 기본 표시 시간은 2.2초입니다.
export function useTemporaryNotice(duration = 2200) {
  // ref의 값은 .value로 읽고 쓰며, 바뀌면 이 값을 사용하는 화면도 갱신됩니다.
  const visible = ref(false)
  // 예약된 타이머 번호를 기억하여 필요할 때 취소할 수 있게 합니다.
  let timer: ReturnType<typeof window.setTimeout> | undefined

  function show() {
    // 연속 호출 시 기존 예약을 취소하고 표시 시간을 처음부터 다시 셉니다.
    if (timer) window.clearTimeout(timer)

    visible.value = true
    // 지정 시간이 지나면 알림을 숨기고 사용이 끝난 타이머 번호도 비웁니다.
    timer = window.setTimeout(() => {
      visible.value = false
      timer = undefined
    }, duration)
  }

  // 페이지 이동으로 컴포넌트가 사라지면 남은 타이머도 제거합니다.
  onUnmounted(() => {
    if (timer) window.clearTimeout(timer)
  })

  // 화면은 visible로 표시 여부를 판단하고, 버튼 등에서는 show를 호출합니다.
  return { visible, show }
}
