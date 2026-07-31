// @vitest-environment jsdom

import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { useTrainingSession } from '@/composables/useTrainingSession'
import { buildTrainingResponse, mapTrainingQuestion } from '@/features/learner/training'
import type { LearnerTrainingQuestionPayload } from '@/features/learner/training'
import HangulBattleActivity from './HangulBattleActivity.vue'

const session = useTrainingSession()

const payload: LearnerTrainingQuestionPayload = {
  trainingId: '190135',
  questionNumber: 1,
  totalQuestions: 1,
  question: {
    questionType: 'HANGUL_BATTLE_BASIC',
    responseType: 'BATTLE_ROUNDS',
    requiredInputs: [],
    content: {
      opponent: 'RABBIT',
      rounds: [
        {
          word: '나비',
          tiles: ['ㄴ', 'ㅏ', 'ㅂ', 'ㅣ', 'ㄷ', 'ㅁ', 'ㅓ', 'ㅗ'],
          opponentDurationMs: 22000,
        },
        {
          word: '모자',
          tiles: ['ㅁ', 'ㅗ', 'ㅈ', 'ㅏ', 'ㄴ', 'ㄷ', 'ㅓ', 'ㅣ'],
          opponentDurationMs: 21000,
        },
      ],
    },
    answer: { answerOrders: [['ㄴ', 'ㅏ', 'ㅂ', 'ㅣ'], ['ㅁ', 'ㅗ', 'ㅈ', 'ㅏ']] },
  },
}

const mounted = () => {
  const mapped = mapTrainingQuestion(payload)
  session.resetSession()
  session.startLesson({
    id: 'battle-lesson',
    categoryId: 'phonics',
    title: '한글 대결',
    description: '',
    activityType: 'hangul-battle',
    estimatedMinutes: 5,
    questions: [mapped.question],
  })
  return { mapped, wrapper: mount(HangulBattleActivity, { props: { question: mapped.question } }) }
}

interface BattleVm {
  phase: string
  roundIndex: number
  roundOrders: string[][]
  placements: Record<number, string>
  finishRound: (winner: 'player' | 'opponent') => void
  advanceRound: () => Promise<void>
}

const fillBoard = (vm: BattleVm, question: ReturnType<typeof mapTrainingQuestion>['question']) => {
  const round = question.battleRounds?.[vm.roundIndex]
  if (!round) throw new Error('라운드가 없습니다.')
  round.answer.forEach((jamo, index) => {
    const tile = round.tiles.find(
      (candidate) => candidate.text === jamo
        && !Object.values(vm.placements).includes(candidate.id),
    )
    if (tile) vm.placements[index] = tile.id
  })
}

describe('한글 대결 채점 제출', () => {
  beforeEach(() => {
    session.setAnswerEvaluator(null)
    session.setAnswerCompletedHandler(null)
    session.resetSession()
  })

  it('라운드마다 놓은 자모 순서를 모아 서버로 올린다', async () => {
    const submissions: unknown[] = []
    session.setAnswerEvaluator(async (answer) => {
      submissions.push(answer)
      return { attemptNo: 1, correct: true, questionCompleted: true, canRetry: false }
    })
    const { mapped, wrapper } = mounted()
    const vm = wrapper.vm as unknown as BattleVm

    for (const _round of mapped.question.battleRounds ?? []) {
      vm.phase = 'racing'
      fillBoard(vm, mapped.question)
      vm.finishRound('player')
      await nextTick()
      await vm.advanceRound()
      await nextTick()
    }

    expect(submissions).toHaveLength(1)
    expect(buildTrainingResponse(mapped, submissions[0] as string[])).toEqual({
      roundOrders: [['ㄴ', 'ㅏ', 'ㅂ', 'ㅣ'], ['ㅁ', 'ㅗ', 'ㅈ', 'ㅏ']],
    })
    wrapper.unmount()
  })

  it('상대가 먼저 이겨 타일을 못 놓은 라운드는 빈 배열로 올린다', async () => {
    const submissions: unknown[] = []
    session.setAnswerEvaluator(async (answer) => {
      submissions.push(answer)
      return { attemptNo: 1, correct: false, questionCompleted: true, canRetry: false }
    })
    const { mapped, wrapper } = mounted()
    const vm = wrapper.vm as unknown as BattleVm

    // 1라운드는 학습자가 맞히고, 2라운드는 하나도 못 놓은 채 상대가 이긴다.
    vm.phase = 'racing'
    fillBoard(vm, mapped.question)
    vm.finishRound('player')
    await vm.advanceRound()
    await nextTick()
    vm.phase = 'racing'
    vm.finishRound('opponent')
    await nextTick()
    await vm.advanceRound()
    await nextTick()

    expect(buildTrainingResponse(mapped, submissions[0] as string[])).toEqual({
      roundOrders: [['ㄴ', 'ㅏ', 'ㅂ', 'ㅣ'], []],
    })
    wrapper.unmount()
  })

  it('서버 채점이 없는 목업 흐름에서는 완료 처리만 한다', async () => {
    const { mapped, wrapper } = mounted()
    const vm = wrapper.vm as unknown as BattleVm

    for (const _round of mapped.question.battleRounds ?? []) {
      vm.phase = 'racing'
      fillBoard(vm, mapped.question)
      vm.finishRound('player')
      await nextTick()
      await vm.advanceRound()
      await nextTick()
    }

    expect(session.progressState.isCurrentCorrect).toBe(true)
    expect(session.storedRecordings[mapped.question.id]?.isMock).toBe(true)
    wrapper.unmount()
  })
})

describe('한글 대결 응답 변환', () => {
  it('라운드 구분자를 유지한 채 roundOrders로 바꾼다', () => {
    const mapped = mapTrainingQuestion(payload)
    expect(buildTrainingResponse(mapped, ['ㄴ|ㅏ|ㅂ|ㅣ', ''])).toEqual({
      roundOrders: [['ㄴ', 'ㅏ', 'ㅂ', 'ㅣ'], []],
    })
  })
})
