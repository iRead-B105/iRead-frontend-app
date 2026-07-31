import type { Component } from 'vue'
import type { TrainingActivityType } from '@/types/training'
import ListenAndSelectActivity from './activities/ListenAndSelectActivity.vue'
import AudioLetterChoiceActivity from './activities/AudioLetterChoiceActivity.vue'
import GazeTraceActivity from './activities/GazeTraceActivity.vue'
import LetterBuildActivity from './activities/LetterBuildActivity.vue'
import SoundManipulationActivity from './activities/SoundManipulationActivity.vue'
import WordReadingGridActivity from './activities/WordReadingGridActivity.vue'
import SoundBuildActivity from './activities/SoundBuildActivity.vue'
import SoundOmitActivity from './activities/SoundOmitActivity.vue'
import SoundChoiceActivity from './activities/SoundChoiceActivity.vue'
import FillBlankActivity from './activities/FillBlankActivity.vue'
import SentenceOrderActivity from './activities/SentenceOrderActivity.vue'
import SentenceChoiceActivity from './activities/SentenceChoiceActivity.vue'

export const trainingActivityComponents: Partial<
  Record<TrainingActivityType, Component>
> = {
  'gaze-trace': GazeTraceActivity,
  'audio-letter-choice': AudioLetterChoiceActivity,
  'letter-build': LetterBuildActivity,
  'sound-manipulation': SoundManipulationActivity,
  'word-reading-grid': WordReadingGridActivity,
  'sentence-reading': WordReadingGridActivity,
  'listen-and-select': ListenAndSelectActivity,
  'sound-choice': SoundChoiceActivity,
  'sound-omit': SoundOmitActivity,
  'sound-blend': SoundBuildActivity,
  'sentence-choice': SentenceChoiceActivity,
  'read-aloud': WordReadingGridActivity,
  'fill-blank': FillBlankActivity,
  'sentence-order': SentenceOrderActivity,
}
