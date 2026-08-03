import type { LearnerTrainingResponseType } from './repository'

/**
 * 치트(debug)/목업 경로에서 mapTrainingQuestion에 주입할 질문 DTO.
 * 백엔드 StudentQuestionDto와 동일 형태라, 실제 API 경로와 완전히 동일하게 렌더링된다.
 * (획/배치/피드백 등을 매퍼가 단일 생성 → 치트 미리보기와 실제 학습이 영원히 갈라지지 않음.)
 *
 * Phase 1: trace 계열만 DTO화. 나머지 학습 유형은 Phase 2에서 추가.
 */
export interface MockStudentQuestionDto {
  readonly questionType: string
  readonly responseType: LearnerTrainingResponseType
  readonly content: Readonly<Record<string, unknown>>
  readonly answer: Readonly<Record<string, unknown>>
  readonly requiredInputs?: readonly string[]
  readonly recordingTargets?: readonly { readonly targetIndex: number; readonly text: string }[]
  readonly recommendedRecordingTargetIndex?: number | null
}

export interface MockTrainingLessonQuestions {
  readonly questions: readonly MockStudentQuestionDto[]
}

type TraceQuestionType = 'VOWEL_TRACE' | 'CONSONANT_TRACE' | 'SYLLABLE_TRACE'

const traceQuestion = (
  questionType: TraceQuestionType,
  glyph: string,
  traceAssetKey: string,
): MockStudentQuestionDto => ({
  questionType,
  responseType: 'TRACE',
  content: { target: glyph, soundText: glyph, traceAssetKey },
  answer: { target: glyph },
})

const consonantTrace = (glyph: string) => traceQuestion('CONSONANT_TRACE', glyph, 'consonant_0')
const vowelTrace = (glyph: string) => traceQuestion('VOWEL_TRACE', glyph, 'vowel_0')
const syllableTrace = (glyph: string) => traceQuestion('SYLLABLE_TRACE', glyph, 'syllable_0')

const mockTrainingQuestionData: Readonly<Record<string, MockTrainingLessonQuestions>> = {
  'trace-consonant': {
    questions: [consonantTrace('ㄱ'), consonantTrace('ㄴ'), consonantTrace('ㅁ')],
  },
  'trace-vowel': {
    questions: [vowelTrace('ㅏ'), vowelTrace('ㅓ'), vowelTrace('ㅗ')],
  },
  'trace-syllable': {
    questions: [syllableTrace('가'), syllableTrace('너'), syllableTrace('모')],
  },
  // 치트 메뉴 "따라 보기 UI": trace-consonant/vowel/syllable의 첫 문항을 모은 합성 미리보기.
  'dev-preview-gaze-trace': {
    questions: [consonantTrace('ㄱ'), vowelTrace('ㅏ'), syllableTrace('가')],
  },
}

/**
 * lessonId로 목업 DTO 질문을 찾는다. 없으면 null(호출부는 legacy 폴백).
 * 실제 학습(API)은 레포지토리 → 매퍼 경로를 그대로 쓰므로 여기에 의존하지 않는다.
 */
export function getMockTrainingLessonData(
  lessonId: string,
): MockTrainingLessonQuestions | null {
  return mockTrainingQuestionData[lessonId] ?? null
}
