import type { Component } from 'vue'
import type { TrainingActivityType } from '@/types/training'
import ListenAndSelectActivity from './activities/ListenAndSelectActivity.vue'
import AudioLetterChoiceActivity from './activities/AudioLetterChoiceActivity.vue'
import GazeTraceActivity from './activities/GazeTraceActivity.vue'
import LetterBuildActivity from './activities/LetterBuildActivity.vue'
import SoundManipulationActivity from './activities/SoundManipulationActivity.vue'
import HangulBattleActivity from './activities/HangulBattleActivity.vue'
import WordReadingGridActivity from './activities/WordReadingGridActivity.vue'
import SentenceReadingActivity from './activities/SentenceReadingActivity.vue'
import SoundBuildActivity from './activities/SoundBuildActivity.vue'
import SoundOmitActivity from './activities/SoundOmitActivity.vue'
import SoundChoiceActivity from './activities/SoundChoiceActivity.vue'
import FillBlankActivity from './activities/FillBlankActivity.vue'
import SentenceOrderActivity from './activities/SentenceOrderActivity.vue'
import CardCombineActivity from './activities/CardCombineActivity.vue'
import SentenceChoiceActivity from './activities/SentenceChoiceActivity.vue'
import ReadAloudActivity from './activities/ReadAloudActivity.vue'

export const trainingActivityComponents: Partial<
  Record<TrainingActivityType, Component>
> = {
  'gaze-trace': GazeTraceActivity,
  'audio-letter-choice': AudioLetterChoiceActivity,
  'letter-build': LetterBuildActivity,
  'sound-manipulation': SoundManipulationActivity,
  'hangul-battle': HangulBattleActivity,
  'word-reading-grid': WordReadingGridActivity,
  'sentence-reading': SentenceReadingActivity,
  'listen-and-select': ListenAndSelectActivity,
  'sound-choice': SoundChoiceActivity,
  'sound-omit': SoundOmitActivity,
  'sound-blend': SoundBuildActivity,
  'card-combine': CardCombineActivity,
  'sentence-choice': SentenceChoiceActivity,
  'read-aloud': ReadAloudActivity,
  'fill-blank': FillBlankActivity,
  'sentence-order': SentenceOrderActivity,
}
