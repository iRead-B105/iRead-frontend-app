import type { TrainingActivityType } from '@/types/training'

const VISUAL_HINT_ACTIVITIES = new Set<TrainingActivityType>([
  'audio-letter-choice',
  'letter-build',
  'listen-and-select',
  'sound-choice',
  'sound-manipulation',
])

export function presentTrainingHint(
  activityType: TrainingActivityType | undefined,
  hint: string | null,
  hintLevel: number,
): string | null {
  if (!hint) return null
  if (hintLevel >= 2 && activityType && VISUAL_HINT_ACTIVITIES.has(activityType)) {
    return '반짝이는 정답 카드를 골라 다시 해봐요.'
  }
  return hint
}
