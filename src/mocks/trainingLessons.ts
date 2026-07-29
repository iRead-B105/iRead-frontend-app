// 플레이 가능한 레슨 목업 데이터
// 각 훈련 대분류별로 한 레슨씩만 실제로 동작합니다.
// 나머지 레슨은 "이 훈련은 준비하고 있어요." 처리됩니다.

import type { TrainingLesson } from '@/types/training'
import { personalizeRuntimeValue } from '@/services/learnerDataRepository'
import { traceConsonantLesson, traceSyllableLesson, traceVowelLesson } from './gazeTraceLessons'
import { letterSoundChoiceLesson, wordFirstSoundChoiceLesson } from './audioChoiceLessons'
import { basicLetterBuildLesson, batchimLetterBuildLesson, doubleBatchimLetterBuildLesson } from './letterBuildLessons'
import { removeBatchimLesson, removeSyllableLesson, replaceSyllableLesson } from './soundManipulationLessons'
import { antBattleLesson, rabbitBattleLesson, turtleBattleLesson } from './hangulBattleLessons'
import { nonwordReadingLesson, realWordReadingLesson } from './wordReadingLessons'
import { sentenceReadingLesson } from './sentenceReadingLessons'
import { shortPassageReadingLesson } from './shortPassageReadingLessons'
import { pictureSentenceLesson } from './pictureSentenceLessons'
import {
  batchimSoundLesson,
  consonantSoundLesson,
  similarSoundLesson,
  vowelSoundLesson,
} from './phonicsLessons'
import {
  fillBlankLesson,
  hardWordLesson,
  repeatSentenceLesson,
  sentenceOrderLesson,
} from './shortTextLessons'
import {
  phraseReadingLesson,
  reReadLesson,
  shortStoryLesson,
  wordChainLesson,
} from './fluencyLessons'

// 음운 인식 - 같은 소리 찾기 (낱말을 듣고 같은 첫소리의 낱말 선택)
export const sameSoundLesson: TrainingLesson = {
  id: 'same-sound',
  categoryId: 'phonological-awareness',
  title: '같은 소리 찾기',
  description: '두 낱말의 첫소리가 같은지 들어봐요.',
  activityType: 'listen-and-select',
  estimatedMinutes: 10,
  questions: [
    {
      id: 'q1',
      instruction: '같은 소리를 찾아봐요.',
      subInstruction: "'가방'과 같은 소리로 시작하는 낱말은?",
      targetText: '가방',
      targetSound: 'ㄱ',
      choices: [
        { id: 'scissors', text: '가위' },
        { id: 'butterfly', text: '나비' },
        { id: 'hat', text: '모자' },
      ],
      answer: 'scissors',
      feedback: {
        correct: '잘 들었어요! 가방과 가위는 같은 소리로 시작해요.',
        retry: '소리를 다시 듣고 골라봐요.',
      },
    },
    {
      id: 'q2',
      instruction: '같은 소리를 찾아봐요.',
      subInstruction: "'나비'와 같은 소리로 시작하는 낱말은?",
      targetText: '나비',
      targetSound: 'ㄴ',
      choices: [
        { id: 'bridge', text: '다리' },
        { id: 'tree', text: '나무' },
        { id: 'lion', text: '사자' },
      ],
      answer: 'tree',
      feedback: {
        correct: '맞아요! 나비와 나무는 같은 소리로 시작해요.',
        retry: '천천히 한 번 더 들어봐요.',
      },
    },
    {
      id: 'q3',
      instruction: '같은 소리를 찾아봐요.',
      subInstruction: "'모자'와 같은 소리로 시작하는 낱말은?",
      targetText: '모자',
      targetSound: 'ㅁ',
      choices: [
        { id: 'sand', text: '모래' },
        { id: 'train', text: '기차' },
        { id: 'rabbit', text: '토끼' },
      ],
      answer: 'sand',
      feedback: {
        correct: '잘 찾았어요! 모자와 모래는 같은 소리로 시작해요.',
        retry: '첫 소리를 다시 들어봐요.',
      },
    },
    {
      id: 'q4',
      instruction: '같은 소리를 찾아봐요.',
      subInstruction: "'사과'와 같은 소리로 시작하는 낱말은?",
      targetText: '사과',
      targetSound: 'ㅅ',
      choices: [
        { id: 'lion', text: '사자' },
        { id: 'banana', text: '바나나' },
        { id: 'train', text: '기차' },
      ],
      answer: 'lion',
      feedback: {
        correct: '맞아요! 사과와 사자는 같은 소리로 시작해요.',
        retry: '소리를 다시 듣고 찾아봐요.',
      },
    },
    {
      id: 'q5',
      instruction: '같은 소리를 찾아봐요.',
      subInstruction: "'토끼'와 같은 소리로 시작하는 낱말은?",
      targetText: '토끼',
      targetSound: 'ㅌ',
      choices: [
        { id: 'tomato', text: '토마토' },
        { id: 'hat', text: '모자' },
        { id: 'butterfly', text: '나비' },
      ],
      answer: 'tomato',
      feedback: {
        correct: '훌륭해요! 토끼와 토마토는 같은 소리로 시작해요.',
        retry: '한 번 더 천천히 들어봐요.',
        completed: '같은 소리 찾기를 모두 마쳤어요!',
      },
    },
  ],
}

// 음운 인식 - 첫소리 찾기 (글자 카드로 첫소리 선택)
export const firstSoundLesson: TrainingLesson = {
  id: 'first-sound',
  categoryId: 'phonological-awareness',
  title: '첫소리 찾기',
  description: '단어를 듣고 첫 번째 소리를 찾아요.',
  activityType: 'listen-and-select',
  estimatedMinutes: 10,
  questions: [
    {
      id: 'q1',
      instruction: '첫소리를 찾아봐요.',
      subInstruction: "'가방'의 첫소리는 무엇일까요?",
      targetText: '가방',
      targetSound: 'ㄱ',
      // 리소스 추가 필요: 가방 그림 PNG
      targetImageLabel: '가방 그림',
      choices: [
        { id: 'g', letter: { jamo: 'ㄱ', type: 'consonant' } },
        { id: 'n', letter: { jamo: 'ㄴ', type: 'consonant' } },
        { id: 'm', letter: { jamo: 'ㅁ', type: 'consonant' } },
      ],
      answer: 'g',
      hint: {
        level1: '가방의 맨 앞 소리를 천천히 들어봐요. "가~방"',
        level2: 'ㄱ 소리를 찾아봐요.',
        highlightChoiceId: 'g',
      },
      feedback: {
        correct: '잘 찾았어요! 가방의 첫소리는 ㄱ이네요.',
        retry: '다시 한번 들어볼까요?',
      },
    },
    {
      id: 'q2',
      instruction: '첫소리를 찾아봐요.',
      subInstruction: "'나비'의 첫소리는 무엇일까요?",
      targetText: '나비',
      targetSound: 'ㄴ',
      // 리소스 추가 필요: 나비 그림 PNG
      targetImageLabel: '나비 그림',
      choices: [
        { id: 'd', letter: { jamo: 'ㄷ', type: 'consonant' } },
        { id: 'n', letter: { jamo: 'ㄴ', type: 'consonant' } },
        { id: 's', letter: { jamo: 'ㅅ', type: 'consonant' } },
      ],
      answer: 'n',
      hint: {
        level1: '나비의 맨 앞 소리를 천천히 들어봐요. "나~비"',
        level2: 'ㄴ 소리를 찾아봐요.',
        highlightChoiceId: 'n',
      },
      feedback: {
        correct: '멋지게 찾았어요! 나비의 첫소리는 ㄴ이네요.',
        retry: '괜찮아요. 한 번 더 해봐요.',
      },
    },
    {
      id: 'q3',
      instruction: '첫소리를 찾아봐요.',
      subInstruction: "'모자'의 첫소리는 무엇일까요?",
      targetText: '모자',
      targetSound: 'ㅁ',
      // 리소스 추가 필요: 모자 그림 PNG
      targetImageLabel: '모자 그림',
      choices: [
        { id: 'm', letter: { jamo: 'ㅁ', type: 'consonant' } },
        { id: 'b', letter: { jamo: 'ㅂ', type: 'consonant' } },
        { id: 'j', letter: { jamo: 'ㅈ', type: 'consonant' } },
      ],
      answer: 'm',
      hint: {
        level1: '모자의 맨 앞 소리를 천천히 들어봐요. "모~자"',
        level2: 'ㅁ 소리를 찾아봐요.',
        highlightChoiceId: 'm',
      },
      feedback: {
        correct: '소리를 아주 잘 들었어요! 모자의 첫소리는 ㅁ이네요.',
        retry: '천천히 다시 들어볼까요?',
      },
    },
    {
      id: 'q4',
      instruction: '첫소리를 찾아봐요.',
      subInstruction: "'다리'의 첫소리는 무엇일까요?",
      targetText: '다리',
      targetSound: 'ㄷ',
      // 리소스 추가 필요: 다리 그림 PNG
      targetImageLabel: '다리 그림',
      choices: [
        { id: 't', letter: { jamo: 'ㅌ', type: 'consonant' } },
        { id: 'd', letter: { jamo: 'ㄷ', type: 'consonant' } },
        { id: 'r', letter: { jamo: 'ㄹ', type: 'consonant' } },
      ],
      answer: 'd',
      hint: {
        level1: '다리의 맨 앞 소리를 천천히 들어봐요. "다~리"',
        level2: 'ㄷ 소리를 찾아봐요.',
        highlightChoiceId: 'd',
      },
      feedback: {
        correct: '훌륭해요! 다리의 첫소리는 ㄷ이네요.',
        retry: '천천히 다시 골라봐요.',
      },
    },
    {
      id: 'q5',
      instruction: '첫소리를 찾아봐요.',
      subInstruction: "'사과'의 첫소리는 무엇일까요?",
      targetText: '사과',
      targetSound: 'ㅅ',
      // 리소스 추가 필요: 사과 그림 PNG
      targetImageLabel: '사과 그림',
      choices: [
        { id: 's', letter: { jamo: 'ㅅ', type: 'consonant' } },
        { id: 'k', letter: { jamo: 'ㅋ', type: 'consonant' } },
        { id: 'c', letter: { jamo: 'ㅊ', type: 'consonant' } },
      ],
      answer: 's',
      hint: {
        level1: '사과의 맨 앞 소리를 천천히 들어봐요. "사~과"',
        level2: 'ㅅ 소리를 찾아봐요.',
        highlightChoiceId: 's',
      },
      feedback: {
        correct: '한 번에 찾았네요! 사과의 첫소리는 ㅅ이네요.',
        retry: '다시 한번 해볼까요?',
        completed: '첫소리 찾기를 모두 마쳤어요! ㄱ, ㄴ, ㅁ, ㄷ, ㅅ 소리를 연습했어요.',
      },
    },
  ],
}

// 음운 인식 - 끝소리 찾기 (낱말을 듣고 받침 소리 선택)
export const lastSoundLesson: TrainingLesson = {
  id: 'last-sound',
  categoryId: 'phonological-awareness',
  title: '끝소리 찾기',
  description: '낱말을 듣고 마지막 소리를 찾아요.',
  activityType: 'listen-and-select',
  estimatedMinutes: 10,
  questions: [
    {
      id: 'q1',
      instruction: '끝소리를 찾아봐요.',
      subInstruction: "'산'의 끝소리는 무엇일까요?",
      targetText: '산',
      targetSound: 'ㄴ',
      choices: [
        { id: 'n', letter: { jamo: 'ㄴ', type: 'consonant' } },
        { id: 'm', letter: { jamo: 'ㅁ', type: 'consonant' } },
        { id: 'r', letter: { jamo: 'ㄹ', type: 'consonant' } },
      ],
      answer: 'n',
      feedback: {
        correct: '잘 찾았어요! 산의 끝소리는 ㄴ이에요.',
        retry: '낱말의 마지막 소리를 다시 들어봐요.',
      },
    },
    {
      id: 'q2',
      instruction: '끝소리를 찾아봐요.',
      subInstruction: "'밤'의 끝소리는 무엇일까요?",
      targetText: '밤',
      targetSound: 'ㅁ',
      choices: [
        { id: 'r', letter: { jamo: 'ㄹ', type: 'consonant' } },
        { id: 'm', letter: { jamo: 'ㅁ', type: 'consonant' } },
        { id: 'g', letter: { jamo: 'ㄱ', type: 'consonant' } },
      ],
      answer: 'm',
      feedback: {
        correct: '맞아요! 밤의 끝소리는 ㅁ이에요.',
        retry: '끝부분을 천천히 다시 들어봐요.',
      },
    },
    {
      id: 'q3',
      instruction: '끝소리를 찾아봐요.',
      subInstruction: "'달'의 끝소리는 무엇일까요?",
      targetText: '달',
      targetSound: 'ㄹ',
      choices: [
        { id: 'n', letter: { jamo: 'ㄴ', type: 'consonant' } },
        { id: 'r', letter: { jamo: 'ㄹ', type: 'consonant' } },
        { id: 'b', letter: { jamo: 'ㅂ', type: 'consonant' } },
      ],
      answer: 'r',
      feedback: {
        correct: '잘 들었어요! 달의 끝소리는 ㄹ이에요.',
        retry: '마지막 소리에 귀 기울여봐요.',
      },
    },
    {
      id: 'q4',
      instruction: '끝소리를 찾아봐요.',
      subInstruction: "'책'의 끝소리는 무엇일까요?",
      targetText: '책',
      targetSound: 'ㄱ',
      choices: [
        { id: 'g', letter: { jamo: 'ㄱ', type: 'consonant' } },
        { id: 's', letter: { jamo: 'ㅅ', type: 'consonant' } },
        { id: 'm', letter: { jamo: 'ㅁ', type: 'consonant' } },
      ],
      answer: 'g',
      feedback: {
        correct: '맞아요! 책의 끝소리는 ㄱ이에요.',
        retry: '책의 끝부분을 다시 들어봐요.',
      },
    },
    {
      id: 'q5',
      instruction: '끝소리를 찾아봐요.',
      subInstruction: "'옷'의 끝소리는 무엇일까요?",
      targetText: '옷',
      targetSound: 'ㄷ',
      choices: [
        { id: 'd', letter: { jamo: 'ㄷ', type: 'consonant' } },
        { id: 's', letter: { jamo: 'ㅅ', type: 'consonant' } },
        { id: 'n', letter: { jamo: 'ㄴ', type: 'consonant' } },
      ],
      answer: 'd',
      feedback: {
        correct: '훌륭해요! 옷의 끝에서 ㄷ 소리가 나요.',
        retry: '소리 나는 끝부분을 다시 들어봐요.',
        completed: '끝소리 찾기를 모두 마쳤어요!',
      },
    },
  ],
}

// 음운 인식 - 소리 나누기(음절 생략): 원래 낱말에서 한 소리를 빼 목표 낱말 만들기
export const soundSplitLesson: TrainingLesson = {
  id: 'sound-split',
  categoryId: 'phonological-awareness',
  title: '소리 나누기',
  description: '낱말에서 소리 하나를 빼고 들은 낱말을 만들어요.',
  activityType: 'sound-omit',
  estimatedMinutes: 12,
  questions: [
    {
      id: 'q1',
      instruction: '한 소리를 빼봐요.',
      subInstruction: '바나나에서 소리 하나를 빼고, 들은 낱말을 만들어요.',
      targetText: '바나나',
      audioText: '바나',
      soundParts: ['바', '나', '나'],
      answer: '바나',
      feedback: { correct: '맞아요! 바나나에서 나를 빼면 바나가 돼요.', retry: '들은 소리와 다른 한 조각을 다시 찾아봐요.' },
    },
    {
      id: 'q2',
      instruction: '한 소리를 빼봐요.',
      subInstruction: '고구마에서 소리 하나를 빼고, 들은 낱말을 만들어요.',
      targetText: '고구마',
      audioText: '고마',
      soundParts: ['고', '구', '마'],
      answer: '고마',
      feedback: { correct: '잘했어요! 고구마에서 구를 빼면 고마가 돼요.', retry: '들은 소리에는 없는 조각을 찾아봐요.' },
    },
    {
      id: 'q3',
      instruction: '한 소리를 빼봐요.',
      subInstruction: '코끼리에서 소리 하나를 빼고, 들은 낱말을 만들어요.',
      targetText: '코끼리',
      audioText: '코리',
      soundParts: ['코', '끼', '리'],
      answer: '코리',
      feedback: { correct: '맞아요! 코끼리에서 끼를 빼면 코리가 돼요.', retry: '목표 소리를 다시 듣고 다른 조각을 빼봐요.' },
    },
    {
      id: 'q4',
      instruction: '한 소리를 빼봐요.',
      subInstruction: '기차표에서 소리 하나를 빼고, 들은 낱말을 만들어요.',
      targetText: '기차표',
      audioText: '기차',
      soundParts: ['기', '차', '표'],
      answer: '기차',
      feedback: { correct: '잘했어요! 기차표에서 표를 빼면 기차가 돼요.', retry: '들은 낱말의 끝소리를 다시 확인해봐요.' },
    },
    {
      id: 'q5',
      instruction: '한 소리를 빼봐요.',
      subInstruction: '무지개에서 소리 하나를 빼고, 들은 낱말을 만들어요.',
      targetText: '무지개',
      audioText: '지개',
      soundParts: ['무', '지', '개'],
      answer: '지개',
      feedback: { correct: '훌륭해요! 무지개에서 무를 빼면 지개가 돼요.', retry: '처음 소리부터 천천히 비교해봐요.', completed: '소리 나누기를 모두 마쳤어요!' },
    },
  ],
}

// 음운 인식 - 소리 합치기 (나뉜 소리를 듣고 음절 카드를 순서대로 배치)
export const soundCombineLesson: TrainingLesson = {
  id: 'sound-combine',
  categoryId: 'phonological-awareness',
  title: '소리 합치기',
  description: '나뉜 소리를 듣고 하나의 낱말로 모아요.',
  activityType: 'sound-blend',
  estimatedMinutes: 12,
  questions: [
    {
      id: 'q1',
      instruction: '소리를 합쳐봐요.',
      subInstruction: '들은 소리를 차례로 모아보세요.',
      combined: '가방',
      soundParts: ['가', '방'],
      choices: [
        { id: 'bang', text: '방' },
        { id: 'na', text: '나' },
        { id: 'ga', text: '가' },
      ],
      answer: 'ga|bang',
      feedback: { correct: '맞아요! 가와 방을 합치면 가방이 돼요.', retry: '소리의 순서를 다시 들어봐요.' },
    },
    {
      id: 'q2',
      instruction: '소리를 합쳐봐요.',
      subInstruction: '들은 소리를 차례로 모아보세요.',
      combined: '나비',
      soundParts: ['나', '비'],
      choices: [
        { id: 'bi', text: '비' },
        { id: 'mo', text: '모' },
        { id: 'na', text: '나' },
      ],
      answer: 'na|bi',
      feedback: { correct: '잘했어요! 나와 비를 합치면 나비가 돼요.', retry: '첫 소리부터 다시 모아봐요.' },
    },
    {
      id: 'q3',
      instruction: '소리를 합쳐봐요.',
      subInstruction: '들은 소리를 차례로 모아보세요.',
      combined: '모자',
      soundParts: ['모', '자'],
      choices: [
        { id: 'ja', text: '자' },
        { id: 'sa', text: '사' },
        { id: 'mo', text: '모' },
      ],
      answer: 'mo|ja',
      feedback: { correct: '맞아요! 모와 자를 합치면 모자가 돼요.', retry: '나뉜 소리를 다시 들어봐요.' },
    },
    {
      id: 'q4',
      instruction: '소리를 합쳐봐요.',
      subInstruction: '들은 소리를 차례로 모아보세요.',
      combined: '사과',
      soundParts: ['사', '과'],
      choices: [
        { id: 'gwa', text: '과' },
        { id: 'sa', text: '사' },
        { id: 'ga', text: '가' },
      ],
      answer: 'sa|gwa',
      feedback: { correct: '잘 모았어요! 사와 과를 합치면 사과가 돼요.', retry: '두 소리의 순서를 다시 들어봐요.' },
    },
    {
      id: 'q5',
      instruction: '소리를 합쳐봐요.',
      subInstruction: '들은 소리를 차례로 모아보세요.',
      combined: '기차',
      soundParts: ['기', '차'],
      choices: [
        { id: 'cha', text: '차' },
        { id: 'na', text: '나' },
        { id: 'gi', text: '기' },
      ],
      answer: 'gi|cha',
      feedback: { correct: '훌륭해요! 기와 차를 합치면 기차가 돼요.', retry: '소리를 다시 듣고 차례로 모아봐요.', completed: '소리 합치기를 모두 마쳤어요!' },
    },
  ],
}

// 파닉스 - 자음과 모음 합치기 (카드를 끌어다 놓거나 눌러서 음절 만들기)
export const combineCVLesson: TrainingLesson = {
  id: 'combine-cv',
  categoryId: 'phonics',
  title: '자음과 모음 합치기',
  description: '자음 카드와 모음 카드를 모아 한 글자를 만들어요.',
  activityType: 'card-combine',
  estimatedMinutes: 12,
  questions: [
    {
      id: 'q1',
      instruction: '글자를 모아봐요.',
      subInstruction: 'ㄱ과 ㅏ를 모으면 어떤 글자가 될까요?',
      consonant: 'ㄱ',
      vowel: 'ㅏ',
      combined: '가',
      answer: '가',
      hint: { level1: 'ㄱ 소리와 ㅏ 소리를 차례로 들어봐요.', level2: 'ㄱ + ㅏ = 가' },
      feedback: {
        correct: '글자를 멋지게 모았어요! ㄱ과 ㅏ를 모으면 가가 돼요.',
        retry: '다시 한번 모아볼까요?',
      },
    },
    {
      id: 'q2',
      instruction: '글자를 모아봐요.',
      subInstruction: 'ㄴ과 ㅗ를 모으면 어떤 글자가 될까요?',
      consonant: 'ㄴ',
      vowel: 'ㅗ',
      combined: '노',
      answer: '노',
      hint: { level1: 'ㄴ 소리와 ㅗ 소리를 차례로 들어봐요.', level2: 'ㄴ + ㅗ = 노' },
      feedback: {
        correct: '잘 합쳤어요! ㄴ과 ㅗ를 모으면 노가 돼요.',
        retry: '괜찮아요. 한 번 더 해봐요.',
      },
    },
    {
      id: 'q3',
      instruction: '글자를 모아봐요.',
      subInstruction: 'ㅁ과 ㅜ를 모으면 어떤 글자가 될까요?',
      consonant: 'ㅁ',
      vowel: 'ㅜ',
      combined: '무',
      answer: '무',
      hint: { level1: 'ㅁ 소리와 ㅜ 소리를 차례로 들어봐요.', level2: 'ㅁ + ㅜ = 무' },
      feedback: {
        correct: '소리를 아주 잘 만들었어요! ㅁ과 ㅜ를 모으면 무가 돼요.',
        retry: '천천히 다시 모아볼까요?',
      },
    },
    {
      id: 'q4',
      instruction: '글자를 모아봐요.',
      subInstruction: 'ㄷ과 ㅏ를 모으면 어떤 글자가 될까요?',
      consonant: 'ㄷ',
      vowel: 'ㅏ',
      combined: '다',
      answer: '다',
      hint: { level1: 'ㄷ 소리와 ㅏ 소리를 차례로 들어봐요.', level2: 'ㄷ + ㅏ = 다' },
      feedback: {
        correct: '훌륭해요! ㄷ과 ㅏ를 모으면 다가 돼요.',
        retry: '천천히 다시 모아봐요.',
      },
    },
    {
      id: 'q5',
      instruction: '글자를 모아봐요.',
      subInstruction: 'ㅂ과 ㅗ를 모으면 어떤 글자가 될까요?',
      consonant: 'ㅂ',
      vowel: 'ㅗ',
      combined: '보',
      answer: '보',
      hint: { level1: 'ㅂ 소리와 ㅗ 소리를 차례로 들어봐요.', level2: 'ㅂ + ㅗ = 보' },
      feedback: {
        correct: '완성했어요! ㅂ과 ㅗ를 모으면 보가 돼요.',
        retry: '다시 한번 해볼까요?',
        completed: '자음과 모음 합치기를 모두 마쳤어요! 가, 노, 무, 다, 보를 연습했어요.',
      },
    },
  ],
}

// 유창성 - 문장 따라 읽기 (모범 음성 듣기 + 녹음)
export const followSentenceLesson: TrainingLesson = {
  id: 'follow-sentence',
  categoryId: 'fluency',
  title: '문장 따라 읽기',
  description: '모범 음성을 듣고 따라 읽어요.',
  activityType: 'read-aloud',
  estimatedMinutes: 10,
  questions: [
    {
      id: 'q1',
      instruction: '문장을 따라 읽어봐요.',
      subInstruction: '모범 음성을 듣고 따라 읽어요.',
      targetText: '토끼가 산으로 가요.',
      phraseChunks: ['토끼가', '산으로', '가요.'],
      answer: 'q1',
      hint: { level1: '천천히 따라 읽어봐요.', level2: '토끼가 / 산으로 / 가요.' },
      feedback: {
        correct: '잘 읽었어요! 자연스럽게 읽네요.',
        retry: '천천히 다시 읽어볼까요?',
      },
    },
    {
      id: 'q2',
      instruction: '문장을 따라 읽어봐요.',
      subInstruction: '모범 음성을 듣고 따라 읽어요.',
      targetText: '노란 나비가 날아가요.',
      phraseChunks: ['노란', '나비가', '날아가요.'],
      answer: 'q2',
      hint: { level1: '나비가 어디로 날아가나요?', level2: '노란 / 나비가 / 날아가요.' },
      feedback: {
        correct: '멋지게 읽었어요! 발음이 또렷하네요.',
        retry: '괜찮아요. 한 번 더 읽어봐요.',
      },
    },
    {
      id: 'q3',
      instruction: '문장을 따라 읽어봐요.',
      subInstruction: '모범 음성을 듣고 따라 읽어요.',
      targetText: '민수는 작은 공을 잡아요.',
      phraseChunks: ['민수는', '작은', '공을', '잡아요.'],
      answer: 'q3',
      hint: { level1: '민수가 무엇을 잡나요?', level2: '민수는 / 작은 / 공을 / 잡아요.' },
      feedback: {
        correct: '훌륭해요! 문장을 또박또박 읽었네요.',
        retry: '천천히 다시 읽어볼까요?',
      },
    },
    {
      id: 'q4',
      instruction: '문장을 따라 읽어봐요.',
      subInstruction: '모범 음성을 듣고 따라 읽어요.',
      targetText: '오늘은 햇빛이 따뜻해요.',
      phraseChunks: ['오늘은', '햇빛이', '따뜻해요.'],
      answer: 'q4',
      hint: { level1: '오늘 날씨가 어떠한가요?', level2: '오늘은 / 햇빛이 / 따뜻해요.' },
      feedback: {
        correct: '잘 읽었어요! 감정이 살아있네요.',
        retry: '천천히 다시 읽어봐요.',
        completed: '문장 따라 읽기를 모두 마쳤어요! 문장을 자연스럽게 익혔어요.',
      },
    },
  ],
}

// 레슨 맵 (레슨 ID로 레슨 데이터 조회)
export const lessonMap: Record<string, TrainingLesson> = {
  'trace-consonant': traceConsonantLesson,
  'trace-vowel': traceVowelLesson,
  'trace-syllable': traceSyllableLesson,
  'letter-sound-choice': letterSoundChoiceLesson,
  'word-first-sound-choice': wordFirstSoundChoiceLesson,
  'build-basic-letter': basicLetterBuildLesson,
  'build-batchim-letter': batchimLetterBuildLesson,
  'build-double-batchim-letter': doubleBatchimLetterBuildLesson,
  'remove-batchim': removeBatchimLesson,
  'remove-syllable': removeSyllableLesson,
  'replace-syllable': replaceSyllableLesson,
  'battle-rabbit': rabbitBattleLesson,
  'battle-turtle': turtleBattleLesson,
  'battle-ant': antBattleLesson,
  'read-real-words': realWordReadingLesson,
  'read-nonwords': nonwordReadingLesson,
  'read-sentences': sentenceReadingLesson,
  'read-short-passage': shortPassageReadingLesson,
  'same-sound': sameSoundLesson,
  'first-sound': firstSoundLesson,
  'last-sound': lastSoundLesson,
  'sound-split': soundSplitLesson,
  'sound-combine': soundCombineLesson,
  'consonant-sound': consonantSoundLesson,
  'vowel-sound': vowelSoundLesson,
  'combine-cv': combineCVLesson,
  'batchim-sound': batchimSoundLesson,
  'similar-sound': similarSoundLesson,
  'repeat-sentence': repeatSentenceLesson,
  'fill-blank': fillBlankLesson,
  'match-picture': pictureSentenceLesson,
  'hard-word': hardWordLesson,
  'sentence-order': sentenceOrderLesson,
  'word-chain': wordChainLesson,
  'follow-sentence': followSentenceLesson,
  'phrase-reading': phraseReadingLesson,
  're-read': reReadLesson,
  'short-story': shortStoryLesson,
}

export const getLessonById = (id: string): TrainingLesson | null => {
  const lesson = lessonMap[id]
  return lesson ? personalizeRuntimeValue(lesson) : null
}
