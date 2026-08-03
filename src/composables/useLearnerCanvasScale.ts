import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export const LEARNER_CANVAS_WIDTH = 1920
export const LEARNER_CANVAS_HEIGHT = 1200

export const calculateLearnerCanvasScale = (
  viewportWidth: number,
  viewportHeight: number,
): number => Math.min(
  viewportWidth / LEARNER_CANVAS_WIDTH,
  viewportHeight / LEARNER_CANVAS_HEIGHT,
)

export function useLearnerCanvasScale() {
  const scale = ref(calculateLearnerCanvasScale(window.innerWidth, window.innerHeight))

  const updateScale = () => {
    scale.value = calculateLearnerCanvasScale(window.innerWidth, window.innerHeight)
  }

  onMounted(() => {
    updateScale()
    window.addEventListener('resize', updateScale)
    window.visualViewport?.addEventListener('resize', updateScale)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateScale)
    window.visualViewport?.removeEventListener('resize', updateScale)
  })

  const canvasStyle = computed(() => ({
    '--learner-canvas-scale': String(scale.value),
  }))

  return { scale, canvasStyle }
}
