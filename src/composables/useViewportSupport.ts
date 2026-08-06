// 아동 앱을 쓸 수 있는 화면인지 판단한다.
//
// 아동 앱은 1920x1200 캔버스를 축소해 그리고, 시선 추적과 마이크를 함께 쓴다.
// 휴대폰처럼 좁은 화면이나 터치 전용 기기에서는 훈련 자체가 성립하지 않으므로
// 절반만 동작하는 화면을 보여주지 않고 지원하지 않는다고 알린다.

import { onBeforeUnmount, onMounted, readonly, ref } from 'vue'

// 축소해서라도 훈련 화면을 배치할 수 있는 최소 크기.
// 태블릿 가로(1024x768)는 통과하고 휴대폰은 가로·세로 모두 걸린다.
export const MIN_VIEWPORT_WIDTH = 1024
export const MIN_VIEWPORT_HEIGHT = 640

export type ViewportConditions = {
  width: number
  height: number
  /** 주 입력이 손가락 등 굵은 포인터인가(matchMedia '(pointer: coarse)'). */
  coarsePointer: boolean
  /** 마우스처럼 hover 가 가능한가(matchMedia '(hover: hover)'). */
  hoverCapable: boolean
}

export type UnsupportedReason = 'touch-only' | 'viewport-too-small'

/** 지원하지 않는 이유. 지원하는 화면이면 null. */
export function resolveUnsupportedReason(
  conditions: ViewportConditions,
): UnsupportedReason | null {
  // 터치 전용 기기 판정은 두 조건을 함께 본다. 터치스크린이 달린 노트북은
  // 주 입력이 트랙패드라 pointer: fine 으로 보고되므로 잘못 막지 않는다.
  if (conditions.coarsePointer && !conditions.hoverCapable) return 'touch-only'
  if (conditions.width < MIN_VIEWPORT_WIDTH) return 'viewport-too-small'
  if (conditions.height < MIN_VIEWPORT_HEIGHT) return 'viewport-too-small'
  return null
}

const matches = (query: string): boolean =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia(query).matches

const readConditions = (): ViewportConditions => ({
  width: typeof window === 'undefined' ? MIN_VIEWPORT_WIDTH : window.innerWidth,
  height: typeof window === 'undefined' ? MIN_VIEWPORT_HEIGHT : window.innerHeight,
  coarsePointer: matches('(pointer: coarse)'),
  hoverCapable: matches('(hover: hover)'),
})

export function useViewportSupport() {
  const conditions = ref<ViewportConditions>(readConditions())
  const unsupportedReason = ref<UnsupportedReason | null>(
    resolveUnsupportedReason(conditions.value),
  )

  const refresh = () => {
    conditions.value = readConditions()
    unsupportedReason.value = resolveUnsupportedReason(conditions.value)
  }

  onMounted(() => {
    refresh()
    window.addEventListener('resize', refresh)
    // 기기를 돌리면 innerWidth/innerHeight 가 바뀌는 시점이 resize 와 어긋날 수 있다.
    window.addEventListener('orientationchange', refresh)
    window.visualViewport?.addEventListener('resize', refresh)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', refresh)
    window.removeEventListener('orientationchange', refresh)
    window.visualViewport?.removeEventListener('resize', refresh)
  })

  return {
    conditions: readonly(conditions),
    unsupportedReason: readonly(unsupportedReason),
    refresh,
  }
}
